import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/services/notification_service.dart';
import 'package:campus_connect/models/app_notification.dart';
import 'package:campus_connect/screens/staff/staff_tickets.dart';

class StudentNotificationsScreen extends StatefulWidget {
  final AuthService authService;
  final TicketService ticketService;

  const StudentNotificationsScreen({
    super.key,
    required this.authService,
    required this.ticketService,
  });

  @override
  State<StudentNotificationsScreen> createState() => _StudentNotificationsScreenState();
}

class _StudentNotificationsScreenState extends State<StudentNotificationsScreen> {
  final NotificationService _notificationService = NotificationService();

  @override
  void initState() {
    super.initState();
    _notificationService.addListener(_onNotificationsChanged);
    _notificationService.fetchNotifications();
  }

  @override
  void dispose() {
    _notificationService.removeListener(_onNotificationsChanged);
    _notificationService.dispose();
    super.dispose();
  }

  void _onNotificationsChanged() {
    if (mounted) setState(() {});
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final difference = now.difference(time);
    if (difference.inDays > 1) {
      return DateFormat('MMM d, y').format(time);
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }

  @override
  Widget build(BuildContext context) {
    final notifications = _notificationService.notifications;
    final unreadCount = _notificationService.unreadCount;

    return Container(
      color: const Color(0xFFF5F6FA),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ──────────────────────────────────────────────────────────────
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.horizontalPad(context),
                AppSpacing.lg(context),
                AppSpacing.horizontalPad(context),
                AppSpacing.xs(context),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Notifications',
                          style: TextStyle(
                            fontSize: AppSpacing.isCompact(context) ? 22.0 : 26.0,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFF111827),
                            letterSpacing: -0.5,
                          ),
                        ),
                      ),
                      if (unreadCount > 0)
                        Container(
                          padding: EdgeInsets.symmetric(
                              horizontal: AppSpacing.sm(context),
                              vertical: AppSpacing.xs(context)),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEF4444),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            '$unreadCount New',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: AppSpacing.fontCardTitle(context),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                    ],
                  ),
                  SizedBox(height: AppSpacing.xs(context)),
                  // Role label chip
                  Container(
                    padding: EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm(context), vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      'Status updates only',
                      style: TextStyle(
                        fontSize: AppSpacing.fontCardTitle(context),
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF2563EB),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            SizedBox(height: AppSpacing.md(context)),

            // ── List ─────────────────────────────────────────────────────────
            Expanded(
              child: _notificationService.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _notificationService.error != null
                      ? Center(child: Text(_notificationService.error!))
                      : notifications.isEmpty
                          ? Center(
                              child: Text(
                                'No notifications yet',
                                style: TextStyle(
                                    color: Colors.grey.shade500, fontSize: 16),
                              ),
                            )
                          : RefreshIndicator(
                              onRefresh: () =>
                                  _notificationService.fetchNotifications(),
                              child: ListView.separated(
                                padding:
                                    EdgeInsets.fromLTRB(
                                      AppSpacing.horizontalPad(context), 0,
                                      AppSpacing.horizontalPad(context),
                                      AppSpacing.lg(context),
                                    ),
                                physics:
                                    const AlwaysScrollableScrollPhysics(
                                        parent: BouncingScrollPhysics()),
                                itemCount: notifications.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 12),
                                itemBuilder: (context, index) {
                                  final notification = notifications[index];
                                  return GestureDetector(
                                    onTap: () {
                                      if (!notification.isRead) {
                                        _notificationService
                                            .markAsRead(notification.id);
                                      }
                                      if (notification.ticketId != null) {
                                        try {
                                          final ticket = widget.ticketService.tickets.firstWhere((t) => t.id == notification.ticketId);
                                          showModalBottomSheet(
                                            context: context,
                                            isScrollControlled: true,
                                            backgroundColor: Colors.transparent,
                                            builder: (_) => StaffComplaintDetailsSheet(
                                              complaint: ticket,
                                              staffPosition: 'Student',
                                              staffName: 'Student',
                                              ticketService: widget.ticketService,
                                              onStatusChanged: (_) {},
                                            ),
                                          );
                                        } catch (e) {
                                          debugPrint('Ticket not found for notification: ${notification.ticketId}');
                                        }
                                      }
                                    },
                                    child: _NormalNotificationCard(
                                      notification: {
                                        'title': notification.title,
                                        'subtitle': notification.body,
                                        'time': _formatTime(notification.createdAt),
                                        'type': notification.type,
                                        'read': notification.isRead,
                                      },
                                    ),
                                  );
                                },
                              ),
                            ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NormalNotificationCard extends StatelessWidget {
  final Map<String, dynamic> notification;
  const _NormalNotificationCard({Key? key, required this.notification})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    final type = notification['type'] as String? ?? '';
    final title = notification['title'] as String? ?? '';
    final subtitle = notification['subtitle'] as String? ?? '';
    final timeLabel = notification['time'] as String?;
    final isRead = notification['read'] as bool? ?? false;

    IconData iconData;
    Color iconColor;
    Color iconBg;

    switch (type) {
      case 'submitted':
        iconData = Icons.send_rounded;
        iconColor = const Color(0xFF2563EB);
        iconBg = const Color(0xFFEFF6FF);
        break;
      case 'inprogress':
        iconData = Icons.autorenew_rounded;
        iconColor = const Color(0xFFEA580C);
        iconBg = const Color(0xFFFFF7ED);
        break;
      case 'resolved':
        iconData = Icons.check_circle_rounded;
        iconColor = const Color(0xFF16A34A);
        iconBg = const Color(0xFFDCFCE7);
        break;
      default:
        iconData = Icons.notifications_rounded;
        iconColor = const Color(0xFF6B7280);
        iconBg = const Color(0xFFF3F4F6);
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 15,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Icon
          Builder(
            builder: (context) {
              final sz = MediaQuery.sizeOf(context).width < 360 ? 40.0 : 48.0;
              return Container(
                width: sz,
                height: sz,
                decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
                child: Icon(iconData, color: iconColor, size: 22),
              );
            },
          ),
          const SizedBox(width: 14),

          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(title,
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF111827))),
                    ),
                    if (!isRead)
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Color(0xFF2563EB),
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(subtitle,
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: Colors.grey.shade500,
                          height: 1.4)),
                ],
                if (timeLabel != null) ...[
                  const SizedBox(height: 4),
                  Text(timeLabel,
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: Colors.grey.shade400)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}