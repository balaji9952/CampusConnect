import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import 'package:campus_connect/globals.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/screens/common/ticket_detail_screen.dart';

// Top-level handler required by Firebase for background messages
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('[FCM] Background message: ${message.messageId}');
}

class FCMService {
  // ── Singleton ──────────────────────────────────────────────────────────────
  static final FCMService _instance = FCMService._internal();
  factory FCMService() => _instance;
  FCMService._internal();

  // ── Internals ─────────────────────────────────────────────────────────────
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  bool _isInitialized = false;

  final StreamController<RemoteMessage> _foregroundMessageController = StreamController<RemoteMessage>.broadcast();
  Stream<RemoteMessage> get onForegroundMessage => _foregroundMessageController.stream;

  // Key constants
  static const String _deviceIdKey = 'campus_connect_device_id';
  static const String _lastSyncedTokenKey = 'campus_connect_last_fcm_token';
  static const String _migrationVersionKey = 'campus_connect_fcm_migration_version';
  static const String _pendingNotificationKey = 'campus_connect_pending_notification';
  static const int _currentMigrationVersion = 1;
  final Set<String> _handledMessageIds = {};

  // The Android notification channel
  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'high_importance_channel',
    'High Importance Notifications',
    description: 'Campus Connect alerts, ticket updates and reminders.',
    importance: Importance.max,
  );

  // ── Public: Initialize ────────────────────────────────────────────────────

  /// Call once in main() after Firebase.initializeApp().
  /// Idempotent — safe to call multiple times.
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      // 1. Request OS-level permissions
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );
      debugPrint('[FCM] Permission: ${settings.authorizationStatus}');
    } catch (e, s) {
      debugPrint('[FCM] Permission Error: $e\n$s');
    }

    try {
      // 2. Register background handler (must be top-level function)
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    } catch (e, s) {
      debugPrint('[FCM] Background Handler Error: $e\n$s');
    }

    try {
      // 3. Initialise local notifications plugin
      const AndroidInitializationSettings androidSettings =
          AndroidInitializationSettings('@mipmap/ic_launcher');
      const DarwinInitializationSettings iosSettings =
          DarwinInitializationSettings(
        requestAlertPermission: false, // Already requested above
        requestBadgePermission: false,
        requestSoundPermission: false,
      );
      await _localNotifications.initialize(
        const InitializationSettings(
            android: androidSettings, iOS: iosSettings),
        onDidReceiveNotificationResponse: (NotificationResponse resp) {
          debugPrint('[FCM] Local Notification tapped: ${resp.payload}');
          if (resp.payload != null && resp.payload!.isNotEmpty) {
            try {
              final Map<String, dynamic> data = jsonDecode(resp.payload!);
              _handleNotificationTap(data);
            } catch (e) {
              debugPrint('[FCM] Error decoding local payload: $e');
            }
          }
        },
      );
    } catch (e, s) {
      debugPrint('[FCM] Local Notifications Init Error: $e\n$s');
    }

    try {
      // 4. Create Android notification channel and request permission
      final androidImplementation = _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();
      
      await androidImplementation?.createNotificationChannel(_channel);
      await androidImplementation?.requestNotificationsPermission();
    } catch (e, s) {
      debugPrint('[FCM] Channel Creation/Permission Error: $e\n$s');
    }

    try {
      // 5. Show heads-up popup for foreground messages
      FirebaseMessaging.onMessage.listen(_showLocalNotification);

      // 5b. Handle background message taps
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        debugPrint('[FCM] Background Notification tapped: ${message.messageId}');
        _handleNotificationTap(message.data);
      });

      // 5c. Handle terminated app message taps
      FirebaseMessaging.instance.getInitialMessage().then((RemoteMessage? message) {
        if (message != null) {
          debugPrint('[FCM] Terminated Notification tapped: ${message.messageId}');
          _handleNotificationTap(message.data);
        }
      });
    } catch (e, s) {
      debugPrint('[FCM] Listeners Error: $e\n$s');
    }

    // 6. Perform one-time token migration if needed
    await _performTokenMigration();

    _isInitialized = true;
    debugPrint('[FCM] Initialized successfully.');
  }

  Future<void> _performTokenMigration() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final int savedVersion = prefs.getInt(_migrationVersionKey) ?? 0;

      if (savedVersion < _currentMigrationVersion) {
        debugPrint('[FCM] Performing token migration to version $_currentMigrationVersion');
        
        try {
          await _messaging.deleteToken();
          debugPrint('[FCM] Successfully deleted legacy token.');
        } catch (e) {
          debugPrint('[FCM] Failed to delete legacy token: $e');
        }

        // We fetch the new token so that if listenForTokenRefresh is active, 
        // or the user logs in, the new token is immediately ready.
        final newToken = await _messaging.getToken();
        debugPrint('[FCM] Migrated to new token: $newToken');
        
        await prefs.setInt(_migrationVersionKey, _currentMigrationVersion);
      }
    } catch (e) {
      debugPrint('[FCM] Error during token migration: $e');
    }
  }

  // ── Public: Device Identity ───────────────────────────────────────────────

  /// Returns a stable, persistent device ID.
  /// Uses SecureStorage as primary store; falls back to SharedPreferences
  /// if SecureStorage is unavailable (e.g., some Android emulators).
  Future<String> getDeviceId() async {
    try {
      // Try SecureStorage first (survives account changes, not app uninstall)
      String? deviceId = await _secureStorage.read(key: _deviceIdKey);
      if (deviceId != null && deviceId.isNotEmpty) return deviceId;

      // Generate a new UUID and persist it
      deviceId = const Uuid().v4();
      await _secureStorage.write(key: _deviceIdKey, value: deviceId);
      return deviceId;
    } catch (e) {
      debugPrint('[FCM] SecureStorage unavailable, falling back to SharedPreferences: $e');
      // Fallback: SharedPreferences (can be cleared by user, but acceptable)
      final prefs = await SharedPreferences.getInstance();
      String? deviceId = prefs.getString(_deviceIdKey);
      if (deviceId != null && deviceId.isNotEmpty) return deviceId;

      deviceId = const Uuid().v4();
      await prefs.setString(_deviceIdKey, deviceId);
      return deviceId;
    }
  }

  // ── Public: Token Management ──────────────────────────────────────────────

  /// Returns the current FCM device token, or null if unavailable.
  Future<String?> getToken() async {
    try {
      return await _messaging.getToken();
    } catch (e) {
      debugPrint('[FCM] Error getting token: $e');
      return null;
    }
  }

  /// Returns the last synced token from local storage.
  Future<String?> getLastSyncedToken() async {
    try {
      return await _secureStorage.read(key: _lastSyncedTokenKey);
    } catch (_) {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_lastSyncedTokenKey);
    }
  }

  /// Persists the synced token locally so we can detect changes on startup.
  Future<void> saveLastSyncedToken(String token) async {
    try {
      await _secureStorage.write(key: _lastSyncedTokenKey, value: token);
    } catch (_) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_lastSyncedTokenKey, token);
    }
  }

  /// Starts listening for Firebase token rotation.
  /// When the token changes, [onTokenRefreshed] is called with the new token.
  /// Typically called once per login session from AuthService.
  void listenForTokenRefresh(Future<void> Function(String newToken) onTokenRefreshed) {
    _messaging.onTokenRefresh.listen((newToken) async {
      debugPrint('[FCM] Token rotated by Firebase. Syncing...');
      await onTokenRefreshed(newToken);
    });
  }

  // ── Private: Local notification display ──────────────────────────────────

  void _showLocalNotification(RemoteMessage message) {
    _foregroundMessageController.add(message);

    final notification = message.notification;
    if (notification == null) return;

    _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          icon: '@mipmap/ic_launcher',
          importance: Importance.max,
          priority: Priority.high,
        ),
        iOS: const DarwinNotificationDetails(),
      ),
      payload: jsonEncode(message.data),
    );

    debugPrint('[FCM] Foreground notification shown: ${notification.title}');
  }

  // ── Private: Deep Link Navigation ────────────────────────────────────────

  Future<void> _handleNotificationTap(Map<String, dynamic> data) async {
    final String? messageId = data['messageId']?.toString();
    if (messageId != null) {
      if (_handledMessageIds.contains(messageId)) {
        debugPrint('[FCM] Duplicate tap ignored for messageId: $messageId');
        return;
      }
      _handledMessageIds.add(messageId);
      // Keep set from growing infinitely
      if (_handledMessageIds.length > 50) {
        _handledMessageIds.remove(_handledMessageIds.first);
      }
    }

    // Check if user is authenticated
    if (!AuthService().isAuthenticated) {
      debugPrint('[FCM] User not authenticated. Saving pending payload.');
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_pendingNotificationKey, jsonEncode(data));
      return;
    }

    _navigateFromPayload(data);
  }

  void _navigateFromPayload(Map<String, dynamic> data) {
    debugPrint('[FCM] Navigating from payload: $data');
    final ticketId = data['ticketId']?.toString();
    
    if (ticketId != null && ticketId.isNotEmpty) {
      // Small delay to ensure the navigator is fully mounted if launched from terminated
      Future.delayed(const Duration(milliseconds: 300), () {
        if (navigatorKey.currentState != null) {
          navigatorKey.currentState!.push(
            MaterialPageRoute(
              builder: (context) => TicketDetailScreen(
                ticketId: ticketId,
                ticketService: TicketService(),
              ),
            ),
          );
        } else {
          debugPrint('[FCM] Error: navigatorKey.currentState is null');
        }
      });
    }
  }

  /// Called after successful login to process any notifications tapped while logged out.
  Future<void> processPendingNotification() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final pending = prefs.getString(_pendingNotificationKey);
      if (pending != null && pending.isNotEmpty) {
        debugPrint('[FCM] Processing pending notification payload');
        final Map<String, dynamic> data = jsonDecode(pending);
        await prefs.remove(_pendingNotificationKey);
        _navigateFromPayload(data);
      }
    } catch (e) {
      debugPrint('[FCM] Error processing pending notification: $e');
    }
  }
}
