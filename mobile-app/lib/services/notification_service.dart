import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:campus_connect/services/api_service.dart';
import 'package:campus_connect/models/app_notification.dart';
import 'package:campus_connect/services/realtime_service.dart';

class NotificationService extends ChangeNotifier {
  final ApiService _apiService = ApiService();

  List<AppNotification> _notifications = [];
  bool _isLoading = false;
  String? _error;
  int _unreadCount = 0;
  StreamSubscription? _socketSubscription;

  NotificationService() {
    _socketSubscription = RealtimeService().notificationUpdatesStream.listen((data) {
      final newNotif = AppNotification.fromJson(data);
      if (!_notifications.any((n) => n.id == newNotif.id)) {
        _notifications.insert(0, newNotif);
        if (_notifications.length > 15) {
          _notifications.removeLast();
        }
        _updateUnreadCountLocally();
        notifyListeners();
      }
    });
  }

  @override
  void dispose() {
    _socketSubscription?.cancel();
    super.dispose();
  }

  List<AppNotification> get notifications => _notifications;
  bool get isLoading => _isLoading;
  String? get error => _error;
  int get unreadCount => _unreadCount;

  Future<void> fetchNotifications() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.get('/notifications');
      if (response != null && response['success'] == true) {
        final List<dynamic> data = response['data'] ?? [];
        _notifications = data.map((json) => AppNotification.fromJson(json)).toList();
        _updateUnreadCountLocally();
      } else {
        _error = response?['message'] ?? 'Failed to fetch notifications';
      }
    } catch (e) {
      _error = 'Error fetching notifications: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> markAsRead(String id) async {
    try {
      final response = await _apiService.patch('/notifications/$id/read');
      if (response != null && response['success'] == true) {
        // Update locally
        final index = _notifications.indexWhere((n) => n.id == id);
        if (index != -1) {
          final old = _notifications[index];
          _notifications[index] = AppNotification(
            id: old.id,
            userId: old.userId,
            title: old.title,
            body: old.body,
            type: old.type,
            ticketId: old.ticketId,
            isRead: true,
            privilegedOnly: old.privilegedOnly,
            createdAt: old.createdAt,
          );
          _updateUnreadCountLocally();
          notifyListeners();
        }
      }
    } catch (e) {
      debugPrint('Error marking notification as read: $e');
    }
  }

  Future<void> fetchUnreadCount() async {
    try {
      final response = await _apiService.get('/notifications/unread-count');
      if (response != null && response['success'] == true) {
        _unreadCount = response['data']['count'] ?? 0;
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error fetching unread count: $e');
    }
  }

  void _updateUnreadCountLocally() {
    _unreadCount = _notifications.where((n) => !n.isRead).length;
  }
}
