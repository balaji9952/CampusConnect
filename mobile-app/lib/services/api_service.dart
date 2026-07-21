import 'dart:async';
import 'package:flutter/foundation.dart';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:campus_connect/config/api_config.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final dynamic errors;

  ApiException(this.statusCode, this.message, [this.errors]);

  @override
  String toString() => 'ApiException: $statusCode - $message';
}

/// Thrown when a Google-authenticated user's email is not found in the system.
class AccountNotRegisteredException implements Exception {
  final String email;
  final String message;

  AccountNotRegisteredException({required this.email, required this.message});

  @override
  String toString() => 'AccountNotRegisteredException: $message ($email)';
}

/// Thrown for typed SSO errors returned by the backend.
/// `code` is one of: INVALID_TOKEN | TOKEN_EXPIRED | INVALID_DOMAIN |
/// ACCOUNT_DISABLED | ACCOUNT_NOT_REGISTERED (the last is also surfaced as
/// [AccountNotRegisteredException] for backwards compatibility).
class SsoError implements Exception {
  final String code;
  final String message;

  SsoError({required this.code, required this.message});

  /// Human-readable mapping for the toast/banner.
  String get userMessage {
    switch (code) {
      case 'TOKEN_EXPIRED':
        return 'Your Google session expired. Please sign in again.';
      case 'INVALID_DOMAIN':
        return message; // Backend already includes the domain detail.
      case 'ACCOUNT_DISABLED':
        return message;
      case 'INVALID_TOKEN':
      default:
        return message.isNotEmpty
            ? message
            : 'Google sign-in failed. Please try again.';
    }
  }

  @override
  String toString() => 'SsoError($code): $message';
}

class ApiService {
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage();
  
  // Storage Keys
  static const String _tokenKey = 'auth_token';
  static const String _userRoleKey = 'user_role';
  static const String _userDataKey = 'user_data';

  // Timeout Duration
  static const Duration _timeoutDuration = Duration(seconds: 30);

  // ==========================================
  // CONNECTIVITY HELPER
  // ==========================================
  
  /// Checks if the device has an active internet connection.
  Future<bool> hasInternetConnection() async {
    try {
      final connectivityResult = await Connectivity().checkConnectivity();
      if (connectivityResult.contains(ConnectivityResult.none)) {
        return false;
      }
      return true;
    } catch (e) {
      return false; // Safely assume no connection if check fails
    }
  }

  // ==========================================
  // AUTHENTICATION HELPERS
  // ==========================================

  Future<void> saveToken(String token) async {
    await _secureStorage.write(key: _tokenKey, value: token);
  }

  Future<String?> getToken() async {
    return await _secureStorage.read(key: _tokenKey);
  }

  Future<void> deleteToken() async {
    await _secureStorage.delete(key: _tokenKey);
  }

  Future<void> saveUserRole(String role) async {
    await _secureStorage.write(key: _userRoleKey, value: role);
  }

  Future<String?> getUserRole() async {
    return await _secureStorage.read(key: _userRoleKey);
  }

  Future<void> saveUserData(Map<String, dynamic> userData) async {
    await _secureStorage.write(key: _userDataKey, value: jsonEncode(userData));
  }

  Future<Map<String, dynamic>?> getUserData() async {
    final data = await _secureStorage.read(key: _userDataKey);
    if (data != null) {
      return jsonDecode(data);
    }
    return null;
  }

  Future<void> clearSession() async {
    await _secureStorage.deleteAll();
  }

  // ==========================================
  // CORE HTTP METHODS
  // ==========================================

  Future<Map<String, String>> _getHeaders() async {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (ApiConfig.apiBase.contains('ngrok')) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
    if (ApiConfig.apiBase.contains('loca.lt')) {
      headers['Bypass-Tunnel-Reminder'] = 'true';
    }
    final token = await getToken();
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
      debugPrint('TOKEN: $token');
    } else {
      debugPrint('TOKEN: NULL/EMPTY');
    }
    return headers;
  }

  dynamic _processResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isNotEmpty) {
        return jsonDecode(response.body);
      }
      return null;
    }

    String message = 'Something went wrong';
    dynamic errors;

    try {
      final body = jsonDecode(response.body);
      message = body['message'] ?? message;
      errors = body['errors'];
    } catch (_) {
      // Body is not JSON
      if (response.body.isNotEmpty) {
        message = response.body;
      }
    }

    switch (response.statusCode) {
      case 400:
        throw ApiException(400, message, errors);
      case 401:
        throw ApiException(401, 'Unauthorized: $message');
      case 403:
        throw ApiException(403, 'Forbidden: $message');
      case 404:
        throw ApiException(404, 'Not Found: $message');
      case 500:
        throw ApiException(500, 'Internal Server Error');
      default:
        throw ApiException(response.statusCode, message);
    }
  }

  Future<dynamic> _handleRequest(Future<http.Response> Function() request) async {
    if (!await hasInternetConnection()) {
      throw ApiException(0, 'No internet connection. Please check your network.');
    }

    try {
      final response = await request().timeout(_timeoutDuration);
      return _processResponse(response);
    } on SocketException {
      throw ApiException(0, 'Network error: Cannot reach the server.');
    } on TimeoutException {
      throw ApiException(0, 'Connection timed out. Please try again later.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(0, 'Unexpected error occurred: $e');
    }
  }

  Future<dynamic> get(String endpoint) async {
    final url = Uri.parse('${ApiConfig.apiBase}$endpoint');
    debugPrint('API URL: $url');
    return _handleRequest(() async {
      final headers = await _getHeaders();
      return await http.get(url, headers: headers);
    });
  }

  Future<dynamic> post(String endpoint, {Map<String, dynamic>? body}) async {
    final url = Uri.parse('${ApiConfig.apiBase}$endpoint');
    debugPrint('API URL: $url');
    return _handleRequest(() async {
      final headers = await _getHeaders();
      return await http.post(
        url,
        headers: headers,
        body: body != null ? jsonEncode(body) : null,
      );
    });
  }

  Future<dynamic> put(String endpoint, {Map<String, dynamic>? body}) async {
    final url = Uri.parse('${ApiConfig.apiBase}$endpoint');
    debugPrint('API URL: $url');
    return _handleRequest(() async {
      final headers = await _getHeaders();
      return await http.put(
        url,
        headers: headers,
        body: body != null ? jsonEncode(body) : null,
      );
    });
  }

  Future<dynamic> patch(String endpoint, {Map<String, dynamic>? body}) async {
    final url = Uri.parse('${ApiConfig.apiBase}$endpoint');
    debugPrint('API URL: $url');
    return _handleRequest(() async {
      final headers = await _getHeaders();
      return await http.patch(
        url,
        headers: headers,
        body: body != null ? jsonEncode(body) : null,
      );
    });
  }

  Future<dynamic> delete(String endpoint, {Map<String, dynamic>? body}) async {
    final url = Uri.parse('${ApiConfig.apiBase}$endpoint');
    debugPrint('API URL: $url');
    return _handleRequest(() async {
      final headers = await _getHeaders();
      final request = http.Request('DELETE', url);
      request.headers.addAll(headers);
      if (body != null) {
        request.body = jsonEncode(body);
      }
      final streamedResponse = await request.send();
      return await http.Response.fromStream(streamedResponse);
    });
  }

  /// POST with additional custom headers (e.g., X-Device-ID for QR verification).
  Future<dynamic> postWithHeaders(
    String endpoint, {
    Map<String, dynamic>? body,
    Map<String, String>? extraHeaders,
  }) async {
    final url = Uri.parse('${ApiConfig.apiBase}$endpoint');
    debugPrint('API postWithHeaders URL: $url');
    return _handleRequest(() async {
      final headers = await _getHeaders();
      if (extraHeaders != null) headers.addAll(extraHeaders);
      return await http.post(
        url,
        headers: headers,
        body: body != null ? jsonEncode(body) : null,
      );
    });
  }
}
