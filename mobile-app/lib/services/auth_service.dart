import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:campus_connect/config/api_config.dart';
import 'package:campus_connect/services/api_service.dart';
import 'package:campus_connect/models/user.dart';
import 'package:campus_connect/services/fcm_service.dart';
import 'package:campus_connect/services/realtime_service.dart';

class AuthService {
  final ApiService _apiService = ApiService();
  final FCMService _fcm = FCMService();
  AppUser? _currentUser;

  AppUser? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null;

  Future<bool> isLoggedIn() async {
    final token = await _apiService.getToken();
    if (token != null && token.isNotEmpty) {
      final userData = await _apiService.getUserData();
      if (userData != null) {
        try {
          _currentUser = AppUser.fromJson(userData);
          debugPrint('[Auth] Auto-login: ${_currentUser?.email}');

          // Validate & sync FCM token on every startup
          await _syncFcmTokenIfChanged();

          // Sync profile in background to pick up admin changes
          syncProfile();

          // Start listening for token rotation
          _fcm.listenForTokenRefresh((newToken) async {
            await _registerFcmToken(newToken);
          });

          // Process any pending notifications tapped while logged out
          _fcm.processPendingNotification();

          // Connect Socket.IO
          RealtimeService().connect(token);

          return true;
        } catch (e) {
          debugPrint('[Auth] Session restore failed: $e');
          return false;
        }
      }
    }
    return false;
  }

  Future<bool> syncProfile() async {
    try {
      final response = await _apiService.get('/users/me');
      if (response != null && response['success'] == true) {
        final userJson = response['data'] as Map<String, dynamic>;
        await _apiService.saveUserData(userJson);
        _currentUser = AppUser.fromJson(userJson);
        debugPrint('[Auth] Profile synced from backend');
        return true;
      }
    } catch (e) {
      debugPrint('[Auth] Failed to sync profile: $e');
    }
    return false;
  }

  Future<void> register(Map<String, dynamic> data) async {
    await _apiService.post('/auth/register', body: data);
  }

  Future<void> login(String identifier, String password, int role) async {
    final response = await _apiService.post('/auth/login', body: {
      'identifier': identifier,
      'password': password,
      'role': role,
    });

    if (response != null && response['token'] != null) {
      final token = response['token'];
      final userJson = response['user'];

      await _apiService.saveToken(token);
      await _apiService.saveUserRole(userJson['role'].toString());
      await _apiService.saveUserData(userJson);

      _currentUser = AppUser.fromJson(userJson);
      debugPrint('[Auth] Login: ${_currentUser?.email}');

      // Sync FCM token after login (may be a different user on same device)
      await _syncFcmTokenIfChanged();

      // Start listening for token rotation during this session
      _fcm.listenForTokenRefresh((newToken) async {
        await _registerFcmToken(newToken);
      });

      // Process any pending notifications
      _fcm.processPendingNotification();

      // Connect Socket.IO
      RealtimeService().connect(token);
    } else {
      throw ApiException(400, 'Invalid credentials');
    }
  }

  /// Mobile Google SSO login.
  /// Sends the Google ID token to the backend for verification.
  /// Throws [ApiException] with a user-friendly message on failure.
  /// Throws [AccountNotRegisteredException] if the college account isn't in the DB.
  /// Throws [SsoError] for typed backend errors (INVALID_TOKEN, TOKEN_EXPIRED, etc.)
  Future<void> mobileGoogleLogin(String idToken) async {
    final response = await _apiService.post('/auth/mobile-google-login', body: {
      'idToken': idToken,
    });

    if (response == null) {
      throw ApiException(500, 'No response from server. Check your connection.');
    }

    final status = response['status'] as String?;
    final code   = response['code'] as String?;

    // ── Account not registered (HTTP 403, code: ACCOUNT_NOT_REGISTERED) ──
    if (status == 'ACCOUNT_NOT_REGISTERED' || code == 'ACCOUNT_NOT_REGISTERED') {
      final profile = response['profile'] as Map<String, dynamic>? ?? {};
      throw AccountNotRegisteredException(
        email: profile['email'] as String? ?? '',
        message: response['message'] as String? ??
            'Your account is not registered. Contact the administrator.',
      );
    }

    // ── Other typed SSO errors (HTTP 401/403 with code) ───────────────────
    if (code != null && code != 'OK') {
      throw SsoError(code: code, message: response['message'] as String? ?? 'Google sign-in failed.');
    }

    if (response['success'] == true && response['token'] != null) {
      final token   = response['token'] as String;
      final userJson = response['user'] as Map<String, dynamic>;

      await _apiService.saveToken(token);
      await _apiService.saveUserRole(userJson['role'].toString());
      await _apiService.saveUserData(userJson);

      _currentUser = AppUser.fromJson(userJson);
      debugPrint('[Auth] Google SSO login: ${_currentUser?.email}');

      await _syncFcmTokenIfChanged();

      _fcm.listenForTokenRefresh((newToken) async {
        await _registerFcmToken(newToken);
      });

      _fcm.processPendingNotification();
      RealtimeService().connect(token);
    } else {
      final msg = response['message'] as String? ?? 'Google authentication failed.';
      throw ApiException(401, msg);
    }
  }

  /// Normal Logout — clears the Campus session but keeps the user signed in
  /// to their Google account on this device.
  ///
  /// Steps (in order):
  ///   1. Unlink FCM token (prevents cross-user notification leakage).
  ///   2. Best-effort revoke Campus session on the server.
  ///   3. Clear local Campus JWT + user state.
  ///   4. Disconnect Socket.IO.
  ///   5. `GoogleSignIn().signOut()` — releases the Google account *from the
  ///      app only*. The user's actual Google session in Chrome/Android is
  ///      untouched, so the next "Continue with Google" shows the account
  ///      picker without forcing a password.
  Future<void> logout({bool fromGoogle = false}) async {
    await _unlinkFcmToken();

    // Best-effort server-side revocation — never throw.
    try {
      await _apiService.post('/auth/mobile-google-logout');
    } catch (e) {
      debugPrint('[Auth] Server logout failed (continuing): $e');
    }

    _currentUser = null;
    await _apiService.clearSession();

    RealtimeService().disconnect();

    // ── Google session handling ───────────────────────────────────────────
    // We always release the Google account from the app so the next login
    // shows the account picker (matches the spec's "Normal Logout" UX).
    //
    // If the user explicitly chose "Sign out from Google", we additionally
    // call disconnect() which revokes the OAuth grant — the next sign-in
    // will require fresh consent (and may prompt for a password depending
    // on Google's risk heuristics). We can never force a password prompt
    // from the app side; Google controls that decision.
    try {
      final google = GoogleSignIn();
      if (fromGoogle) {
        await google.disconnect();
        debugPrint('[Auth] Google account disconnected (revoked).');
      } else {
        await google.signOut();
        debugPrint('[Auth] Google account released from app (session retained).');
      }
    } catch (e) {
      // signOut/disconnect can fail if no account is currently signed in —
      // that's fine, treat as success.
      debugPrint('[Auth] Google signOut/disconnect skipped: $e');
    }

    debugPrint('[Auth] Logged out (fromGoogle=$fromGoogle).');
  }

  // ── FCM Token Management ─────────────────────────────────────────────────

  /// Compares the current Firebase token with the last synced one.
  /// Only makes an API call if the token has changed (reduces noise).
  Future<void> _syncFcmTokenIfChanged() async {
    try {
      final currentToken = await _fcm.getToken();
      if (currentToken == null) return;

      final lastSynced = await _fcm.getLastSyncedToken();
      if (currentToken == lastSynced) {
        debugPrint('[FCM] Token unchanged, skipping sync.');
        return;
      }

      debugPrint('[FCM] Token changed or first sync. Registering...');
      await _registerFcmToken(currentToken);
    } catch (e) {
      debugPrint('[FCM] Error during token sync: $e');
    }
  }

  Future<void> _registerFcmToken(String token) async {
    try {
      final deviceId = await _fcm.getDeviceId();
      await _apiService.post('/notifications/fcm-token', body: {
        'token': token,
        'deviceId': deviceId,
      });
      // Persist locally so startup can detect future rotations
      await _fcm.saveLastSyncedToken(token);
      debugPrint('[FCM] Token registered for device: $deviceId');
    } catch (e) {
      debugPrint('[FCM] Failed to register token: $e');
    }
  }

  Future<void> _unlinkFcmToken() async {
    try {
      final currentToken = await _fcm.getToken();
      final deviceId = await _fcm.getDeviceId();
      if (currentToken == null) return;

      await _apiService.delete('/notifications/fcm-token', body: {
        'token': currentToken,
        'deviceId': deviceId,
      });
      debugPrint('[FCM] Token unlinked for device: $deviceId');
    } catch (e) {
      debugPrint('[FCM] Failed to unlink token on logout: $e');
      // Don't block logout — just log and proceed
    }
  }

  // ── Profile Management ───────────────────────────────────────────────────

  Future<void> updateUser({
    required String name,
    required String email,

    required String department,
    required String rollNo,
    String? programType,
    String? branch,
    String? studyYear,
    String? designation,
  }) async {
    final response = await _apiService.put('/users/me', body: {
      'name': name,
      'email': email,

      'rollNo': rollNo,
      'department': department,
      if (programType != null && programType.isNotEmpty) 'programType': programType,
      if (branch != null && branch.isNotEmpty) 'branch': branch,
      if (studyYear != null && studyYear.isNotEmpty) 'studyYear': studyYear,
      if (designation != null && designation.isNotEmpty) 'designation': designation,
    });

    if (response != null && response['success'] == true) {
      final userJson = response['data'] as Map<String, dynamic>;
      await _apiService.saveUserData(userJson);
      _currentUser = AppUser.fromJson(userJson);
    } else {
      throw ApiException(500, 'Profile update failed. Please try again.');
    }
  }

  Future<void> uploadProfilePhoto(List<int> bytes, String filename) async {
    final token = await _apiService.getToken();
    final url = Uri.parse('${ApiConfig.apiBase}/users/me/photo');

    final request = http.MultipartRequest('POST', url);
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    final multipartFile = http.MultipartFile.fromBytes(
      'photo',
      bytes,
      filename: filename.isNotEmpty ? filename : 'avatar.jpg',
      contentType: MediaType('image', 'jpeg'),
    );
    request.files.add(multipartFile);

    final streamed = await request.send().timeout(const Duration(seconds: 30));
    final responseBody = await http.Response.fromStream(streamed);

    if (streamed.statusCode >= 200 && streamed.statusCode < 300) {
      final jsonResponse = jsonDecode(responseBody.body);
      if (jsonResponse['success'] == true) {
        final avatarUrl = jsonResponse['data']['avatarUrl'];
        if (_currentUser != null) {
          final userData = await _apiService.getUserData();
          if (userData != null) {
            userData['avatarUrl'] = avatarUrl;
            await _apiService.saveUserData(userData);
            _currentUser = AppUser.fromJson(userData);
          }
        }
      }
    } else {
      throw ApiException(streamed.statusCode,
          'Profile photo upload failed: ${responseBody.body}');
    }
  }
}
