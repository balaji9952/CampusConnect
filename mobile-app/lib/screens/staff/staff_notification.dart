import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/services/notification_service.dart';
import 'package:campus_connect/screens/staff/staff_tickets.dart';
import 'package:campus_connect/utils/app_spacing.dart';

// ---------------------------------------------------------------------------
// Privileged roles that see full notification details.
// ---------------------------------------------------------------------------
const List<String> _level1Roles = ['HOD', 'Hostel Warden Boys', 'Hostel Warden Girls', 'Mess Warden Boys', 'Mess Warden Girls', 'Canteen Head'];
const List<String> _level2Roles = ['Admin', 'Dean'];
const List<String> _level3Roles = ['Principal'];
const List<String> _privilegedRoles = [
  'HOD', 'Hostel Warden Boys', 'Hostel Warden Girls', 'Mess Warden Boys', 'Mess Warden Girls', 'Canteen Head',
  'Admin', 'Dean', 'Principal'
];
bool _isPrivileged(String position) => _privilegedRoles.contains(position);

// ---------------------------------------------------------------------------
// Normal staff: only these notification types are shown.
// ---------------------------------------------------------------------------
const List<String> _normalStaffTypes = ['submitted', 'inprogress', 'resolved'];

// ===========================================================================
// StaffNotificationsScreen
// ===========================================================================

class StaffNotificationsScreen extends StatefulWidget {
  final TicketService ticketService;
  final String staffPosition;
  final String staffName;

  const StaffNotificationsScreen({
    Key? key,
    required this.ticketService,
    this.staffPosition = 'Assistant Professor',
    this.staffName = 'Staff Member',
  }) : super(key: key);

  @override
  State<StaffNotificationsScreen> createState() => _StaffNotificationsScreenState();
}

class _StaffNotificationsScreenState extends State<StaffNotificationsScreen> {
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

  @override
  Widget build(BuildContext context) {
    final isPrivileged = _isPrivileged(widget.staffPosition);
    final rawAll = _notificationService.notifications;

    // Filter based on roles and levels
    final allNotifications = rawAll.where((n) {
      final isPrivilegedOnly = n.privilegedOnly;
      final type = n.type;
      
      // Personal notifications meant for the user themselves
      if (!isPrivilegedOnly) {
        if (!isPrivileged) {
          return _normalStaffTypes.contains(type);
        }
        return true;
      }

      // Privileged notifications filtering
      if (!isPrivileged) return false;

      // Filter out notifications for tickets this staff member cannot access
      if (n.ticketId != null) {
        final hasTicket = widget.ticketService.tickets.any((t) => t.id == n.ticketId);
        if (!hasTicket) return false;
      }

      // The backend doesn't currently provide 'level' or 'assignedTo' explicitly in the AppNotification model
      // so we rely on the backend's query filtering (where user_id matches or privileged_only = true)
      // but we can still filter by type if needed:
      if (_level3Roles.contains(widget.staffPosition)) {
        if (type == 'escalation_l2') return false; 
      } else if (_level2Roles.contains(widget.staffPosition)) {
        if (type == 'escalation_l3') return false;
      } else if (_level1Roles.contains(widget.staffPosition)) {
        if (type == 'escalation_l2' || type == 'escalation_l3') return false;
      }
      return true;
    }).toList();

    final unreadCount = _notificationService.unreadCount;

    return Container(
      color: const Color(0xFFF5F6FA),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ───────────────────────────────────────────────────────
            Padding(
              padding: EdgeInsets.fromLTRB(AppSpacing.horizontalPad(context), AppSpacing.xl(context), AppSpacing.horizontalPad(context), AppSpacing.xs(context)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Notifications',
                          style: TextStyle(
                            fontSize: AppSpacing.isCompact(context) ? 24.0 : 28.0,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFF111827),
                            letterSpacing: -0.5,
                          ),
                        ),
                      ),
                      if (unreadCount > 0)
                        Container(
                          padding: EdgeInsets.symmetric(
                              horizontal: AppSpacing.sm(context), vertical: AppSpacing.xs(context) / 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEF4444),
                            borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
                          ),
                          child: Text(
                            '$unreadCount New',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: AppSpacing.fontCardTitle(context) - 3,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  // Role label chip
                  Container(
                    padding: EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm(context), vertical: 3),
                    decoration: BoxDecoration(
                      color: isPrivileged
                          ? const Color(0xFFF3E8FF)
                          : const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
                    ),
                    child: Text(
                      isPrivileged
                          ? '${widget.staffPosition} — Full Notifications'
                          : 'Status updates only',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: isPrivileged
                            ? const Color(0xFF7C3AED)
                            : const Color(0xFF2563EB),
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
                      : allNotifications.isEmpty
                          ? _buildEmptyState()
                          : RefreshIndicator(
                              onRefresh: () => _notificationService.fetchNotifications(),
                              child: ListView.separated(
                                padding: EdgeInsets.fromLTRB(AppSpacing.horizontalPad(context), 0, AppSpacing.horizontalPad(context), AppSpacing.xl(context)),
                                physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                                itemCount: allNotifications.length,
                                separatorBuilder: (_, __) =>
                                    SizedBox(height: AppSpacing.sm(context)),
                                itemBuilder: (context, index) {
                                  final notif = allNotifications[index];
                                  final mapNotif = {
                                    'title': notif.title,
                                    'subtitle': notif.body,
                                    'body': notif.body,
                                    'time': DateFormat('MMM d, hh:mm a').format(notif.createdAt),
                                    'type': notif.type,
                                    'timestamp': notif.createdAt.toIso8601String(),
                                    'read': notif.isRead,
                                    'privilegedOnly': notif.privilegedOnly,
                                  };
                                  return GestureDetector(
                                    onTap: () {
                                      if (!notif.isRead) {
                                        _notificationService.markAsRead(notif.id);
                                      }
                                      if (notif.ticketId != null) {
                                        try {
                                          final ticket = widget.ticketService.tickets.firstWhere((t) => t.id == notif.ticketId);
                                          showModalBottomSheet(
                                            context: context,
                                            isScrollControlled: true,
                                            backgroundColor: Colors.transparent,
                                            builder: (_) => StaffComplaintDetailsSheet(
                                              complaint: ticket,
                                              staffPosition: widget.staffPosition,
                                              staffName: widget.staffName,
                                              ticketService: widget.ticketService,
                                              onStatusChanged: (_) {},
                                            ),
                                          );
                                        } catch (e) {
                                          debugPrint('Ticket not found for notification: ${notif.ticketId}');
                                        }
                                      }
                                    },
                                    child: isPrivileged
                                        ? _PrivilegedNotificationCard(notification: mapNotif)
                                        : _NormalNotificationCard(notification: mapNotif),
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

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Builder(
            builder: (context) {
              final boxSize = AppSpacing.isCompact(context) ? 64.0 : 80.0;
              return Container(
                width: boxSize,
                height: boxSize,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(boxSize * 0.3),
                ),
                child: Icon(
                  Icons.notifications_none_rounded,
                  size: boxSize * 0.5,
                  color: const Color(0xFF2563EB),
                ),
              );
            },
          ),
          SizedBox(height: AppSpacing.md(context)),
          Text('No notifications yet',
              style: TextStyle(
                  fontSize: AppSpacing.fontSectionHeader(context) + 2,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF374151))),
          SizedBox(height: AppSpacing.xs(context)),
          Text(
            'You\'ll be notified when there are\nupdates to your complaints.',
            textAlign: TextAlign.center,
            style: TextStyle(
                fontSize: AppSpacing.fontCardTitle(context),
                fontWeight: FontWeight.w500,
                color: Colors.grey.shade500),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Seed notifications for normal staff — status only, no escalation
// ---------------------------------------------------------------------------

List<Map<String, dynamic>> _normalStaffSeedNotifications() => [
      {
        'title': 'Complaint Submitted',
        'subtitle': 'Your complaint has been registered successfully.',
        'body': '',
        'time': '4h',
        'type': 'submitted',
        'timestamp': null,
        'read': false,
        'privilegedOnly': false,
      },
      {
        'title': 'Complaint In Progress',
        'subtitle': 'Your complaint is currently being processed.',
        'body': '',
        'time': '1d',
        'type': 'inprogress',
        'timestamp': null,
        'read': false,
        'privilegedOnly': false,
      },
      {
        'title': 'Complaint Resolved',
        'subtitle': 'Your complaint has been resolved successfully.',
        'body': '',
        'time': '2d',
        'type': 'resolved',
        'timestamp': null,
        'read': true,
        'privilegedOnly': false,
      },
    ];

// ---------------------------------------------------------------------------
// Seed notifications for privileged roles — full details
// ---------------------------------------------------------------------------

List<Map<String, dynamic>> _roleBasedSeedNotifications(String position) {
  if (_level1Roles.contains(position)) {
    return [
      {
        'title': 'New Student Complaint Assigned',
        'subtitle': 'Projector Flickering — ECE Lab 2',
        'body': 'Assigned to $position. Submitted by John Doe (Student).',
        'time': '30m',
        'type': 'new_complaint',
        'timestamp': null,
        'read': false,
        'privilegedOnly': true,
        'level': position,
      },
      {
        'title': 'Complaint Resolved',
        'subtitle': 'Wi-Fi Issue — Library',
        'body': 'Complaint has been successfully resolved at $position.',
        'time': '5h',
        'type': 'resolved',
        'timestamp': null,
        'read': false,
        'privilegedOnly': true,
        'level': position,
      }
    ];
  } else if (_level2Roles.contains(position)) {
    return [
      {
        'title': 'New Staff Complaint Assigned',
        'subtitle': 'AC not cooling — Staff Room 3',
        'body': 'Submitted by Dr. Ramesh (Associate Professor). Assigned directly to Level 2.',
        'time': '1h',
        'type': 'new_complaint',
        'timestamp': null,
        'read': false,
        'privilegedOnly': true,
        'level': 'Level 2',
      },
      {
        'title': 'Student Complaint Escalated from Level 1',
        'subtitle': 'Projector Flickering — ECE Lab 2',
        'body': 'Escalated from Level 1 to Level 2. Unresolved for over 24 hours.',
        'time': '2h',
        'type': 'escalation_l2',
        'timestamp': null,
        'read': false,
        'privilegedOnly': true,
        'level': 'Escalated to Level 2',
      }
    ];
  } else {
    // Principal (Level 3)
    return [
      {
        'title': 'Complaint Escalated to Level 3',
        'subtitle': 'AC not cooling — Staff Room 3',
        'body': 'Escalated to Level 3. Pending beyond SLA.',
        'time': '10m',
        'type': 'escalation_l3',
        'timestamp': null,
        'read': false,
        'privilegedOnly': true,
        'level': 'Escalated to Principal',
      },
      {
        'title': 'Complaint Resolved',
        'subtitle': 'Broken desk chair — Cabin 402',
        'body': 'Resolved by Principal after escalation.',
        'time': '1d',
        'type': 'resolved',
        'timestamp': null,
        'read': false,
        'privilegedOnly': true,
        'level': 'Level 3',
      }
    ];
  }
}

// ===========================================================================
// Normal Staff Notification Card — minimal, status only
// ===========================================================================

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
      padding: EdgeInsets.all(AppSpacing.md(context)),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
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
              final sz = AppSpacing.isCompact(context) ? 40.0 : 48.0;
              return Container(
                width: sz,
                height: sz,
                decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
                child: Icon(iconData, color: iconColor, size: sz * 0.45),
              );
            },
          ),
          SizedBox(width: AppSpacing.sm(context)),

          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(title,
                          style: TextStyle(
                              fontSize: AppSpacing.fontCardTitle(context) + 1,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF111827))),
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
                  SizedBox(height: AppSpacing.xs(context) / 2),
                  Text(subtitle,
                      style: TextStyle(
                          fontSize: AppSpacing.fontCardTitle(context) - 1,
                          fontWeight: FontWeight.w500,
                          color: Colors.grey.shade500,
                          height: 1.4)),
                ],
                if (timeLabel != null) ...[
                  SizedBox(height: AppSpacing.xs(context) / 2),
                  Text(timeLabel,
                      style: TextStyle(
                          fontSize: AppSpacing.fontCardTitle(context) - 3,
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

// ===========================================================================
// Privileged Notification Card — full details, escalation, remarks, level
// ===========================================================================

class _PrivilegedNotificationCard extends StatelessWidget {
  final Map<String, dynamic> notification;
  const _PrivilegedNotificationCard({Key? key, required this.notification})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    final type = notification['type'] as String? ?? '';
    final title = notification['title'] as String? ?? '';
    final subtitle = notification['subtitle'] as String? ?? '';
    final body = notification['body'] as String? ?? '';
    final level = notification['level'] as String?;
    final remarks = notification['remarks'] as String?;
    final userInfo = notification['userInfo'] as String?;
    final escalationFrom = notification['escalationFrom'] as String?;
    final escalationTo = notification['escalationTo'] as String?;
    final timeLabel = notification['time'] as String?;
    final timestampRaw = notification['timestamp'];
    final isRead = notification['read'] as bool? ?? false;

    // Compute time display
    String timeDisplay = timeLabel ?? '';
    if (timestampRaw != null && timeLabel == null) {
      try {
        final ts = DateTime.parse(timestampRaw as String).toLocal();
        timeDisplay = DateFormat('hh:mm a').format(ts);
      } catch (_) {
        timeDisplay = '';
      }
    }

    // Visual config
    IconData iconData;
    Color iconColor;
    Color iconBg;
    Color? borderColor;
    bool isEscalation = type == 'escalation';
    bool isSlaWarning = type == 'sla_warning';

    switch (type) {
      case 'submitted':
      case 'new_complaint':
        iconData = Icons.add_circle_rounded;
        iconColor = const Color(0xFF2563EB);
        iconBg = const Color(0xFFEFF6FF);
        borderColor = null;
        break;
      case 'assigned':
        iconData = Icons.person_pin_rounded;
        iconColor = const Color(0xFF7C3AED);
        iconBg = const Color(0xFFF3E8FF);
        borderColor = null;
        break;
      case 'inprogress':
        iconData = Icons.autorenew_rounded;
        iconColor = const Color(0xFFEA580C);
        iconBg = const Color(0xFFFFF7ED);
        borderColor = null;
        break;
      case 'escalation':
        iconData = Icons.arrow_upward_rounded;
        iconColor = const Color(0xFFEA580C);
        iconBg = const Color(0xFFFFF7ED);
        borderColor = const Color(0xFFFED7AA);
        break;
      case 'sla_warning':
        iconData = Icons.warning_amber_rounded;
        iconColor = const Color(0xFFDC2626);
        iconBg = const Color(0xFFFFE4E6);
        borderColor = const Color(0xFFFECACA);
        break;
      case 'resolved':
        iconData = Icons.check_circle_rounded;
        iconColor = const Color(0xFF16A34A);
        iconBg = const Color(0xFFDCFCE7);
        borderColor = null;
        break;
      default:
        iconData = Icons.notifications_rounded;
        iconColor = const Color(0xFF6B7280);
        iconBg = const Color(0xFFF3F4F6);
        borderColor = null;
    }

    return Container(
      padding: EdgeInsets.all(AppSpacing.md(context)),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
        border: borderColor != null
            ? Border.all(color: borderColor, width: 1.5)
            : null,
        boxShadow: [
          BoxShadow(
            color: (isEscalation || isSlaWarning)
                ? const Color(0xFFEA580C).withValues(alpha: 0.07)
                : Colors.black.withValues(alpha: 0.04),
            blurRadius: 15,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon
              Builder(
                builder: (context) {
                  final sz = AppSpacing.isCompact(context) ? 40.0 : 48.0;
                  return Container(
                    width: sz,
                    height: sz,
                    decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
                    child: Icon(iconData, color: iconColor, size: sz * 0.45),
                  );
                },
              ),
              SizedBox(width: AppSpacing.sm(context)),

              // Title + time
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(title,
                              style: TextStyle(
                                  fontSize: AppSpacing.fontCardTitle(context) + 1,
                                  fontWeight: FontWeight.w700,
                                  color: (isEscalation || isSlaWarning)
                                      ? const Color(0xFFEA580C)
                                      : const Color(0xFF111827))),
                        ),
                        if (!isRead)
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: (isEscalation || isSlaWarning)
                                  ? const Color(0xFFEA580C)
                                  : const Color(0xFF2563EB),
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    if (subtitle.isNotEmpty) ...[
                      SizedBox(height: AppSpacing.xs(context) / 2),
                      Text(subtitle,
                          style: TextStyle(
                              fontSize: AppSpacing.fontCardTitle(context) - 1,
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFF374151))),
                    ],
                  ],
                ),
              ),
            ],
          ),

          // Body message
          if (body.isNotEmpty) ...[
            SizedBox(height: AppSpacing.sm(context)),
            Text(body,
                style: TextStyle(
                    fontSize: AppSpacing.fontCardTitle(context) - 1,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade600,
                    height: 1.4)),
          ],

          // Escalation path chip
          if (isEscalation && escalationFrom != null && escalationTo != null) ...[
            SizedBox(height: AppSpacing.sm(context)),
            Container(
              padding:
                  EdgeInsets.symmetric(horizontal: AppSpacing.sm(context), vertical: AppSpacing.xs(context)),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
                border: Border.all(color: const Color(0xFFFED7AA)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.arrow_upward_rounded,
                      size: AppSpacing.iconSm(context) - 4, color: const Color(0xFFEA580C)),
                  SizedBox(width: AppSpacing.xs(context)),
                  Text(
                    '$escalationFrom → $escalationTo',
                    style: TextStyle(
                        fontSize: AppSpacing.fontCardTitle(context) - 1,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFFEA580C)),
                  ),
                ],
              ),
            ),
          ],

          // Level badge
          if (level != null) ...[
            SizedBox(height: AppSpacing.sm(context)),
            Row(
              children: [
                Container(
                  padding: EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm(context), vertical: AppSpacing.xs(context) / 2),
                  decoration: BoxDecoration(
                    color: isSlaWarning
                        ? const Color(0xFFFFE4E6)
                        : const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isSlaWarning
                            ? Icons.warning_rounded
                            : Icons.layers_rounded,
                        size: AppSpacing.iconSm(context) - 6,
                        color: isSlaWarning
                            ? const Color(0xFFDC2626)
                            : const Color(0xFF2563EB),
                      ),
                      SizedBox(width: AppSpacing.xs(context)),
                      Text(
                        level,
                        style: TextStyle(
                          fontSize: AppSpacing.fontCardTitle(context) - 3,
                          fontWeight: FontWeight.w700,
                          color: isSlaWarning
                              ? const Color(0xFFDC2626)
                              : const Color(0xFF2563EB),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],

          // Remarks snippet
          if (remarks != null && remarks.isNotEmpty) ...[
            SizedBox(height: AppSpacing.sm(context)),
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(AppSpacing.sm(context)),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Remark',
                      style: TextStyle(
                          fontSize: AppSpacing.fontCardTitle(context) - 3,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey.shade500)),
                  SizedBox(height: AppSpacing.xs(context) / 2),
                  Text(remarks,
                      style: TextStyle(
                          fontSize: AppSpacing.fontCardTitle(context) - 1,
                          fontWeight: FontWeight.w500,
                          color: const Color(0xFF374151),
                          height: 1.4)),
                ],
              ),
            ),
          ],

          // User info
          if (userInfo != null) ...[
            SizedBox(height: AppSpacing.sm(context)),
            Row(
              children: [
                Icon(Icons.person_outline_rounded,
                    size: AppSpacing.iconSm(context) - 5, color: const Color(0xFF9CA3AF)),
                SizedBox(width: AppSpacing.xs(context)),
                Text(userInfo,
                    style: TextStyle(
                        fontSize: AppSpacing.fontCardTitle(context) - 2,
                        color: Colors.grey.shade500,
                        fontWeight: FontWeight.w500)),
              ],
            ),
          ],

          // Timestamp
          if (timeDisplay.isNotEmpty) ...[
            SizedBox(height: AppSpacing.xs(context)),
            Text(timeDisplay,
                style: TextStyle(
                    fontSize: AppSpacing.fontCardTitle(context) - 3,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade400)),
          ],
        ],
      ),
    );
  }
}
