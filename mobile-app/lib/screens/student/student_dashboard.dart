import 'dart:async';
import 'package:flutter/material.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/services/fcm_service.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/services/dashboard_service.dart';
import 'package:campus_connect/models/ticket.dart';
import 'package:campus_connect/screens/common/qr_scanner_screen.dart';

import 'package:campus_connect/screens/student/student_tickets.dart';
import 'package:campus_connect/screens/student/student_notification.dart';
import 'package:campus_connect/screens/student/student_profile.dart';
import 'package:campus_connect/screens/common/startup_screen.dart';
import 'package:campus_connect/models/user.dart';
import 'package:campus_connect/services/realtime_service.dart';

class StudentDashboard extends StatefulWidget {
  final AuthService authService;
  final TicketService ticketService;

  const StudentDashboard({
    super.key,
    required this.authService,
    required this.ticketService,
  });

  @override
  State<StudentDashboard> createState() => _StudentDashboardState();
}

class _StudentDashboardState extends State<StudentDashboard> {
  int _selectedIndex = 0;
  StreamSubscription? _fcmSubscription;
  StreamSubscription? _socketTicketSubscription;
  StreamSubscription? _socketConnectionSubscription;

  @override
  void initState() {
    super.initState();
    _fcmSubscription = FCMService().onForegroundMessage.listen((_) {
      debugPrint('[StudentDashboard] Foreground FCM message received');
    });

    _socketTicketSubscription = RealtimeService().ticketUpdatesStream.listen((update) {
      widget.ticketService.handleRealtimeUpdate(update['event'], update['data']);
      if (mounted) setState(() {});
    });

    _socketConnectionSubscription = RealtimeService().connectionStateStream.listen((state) {
      if (state == RealtimeConnectionState.connected) {
        widget.ticketService.fetchTickets(limit: 5).then((_) {
          if (mounted) setState(() {});
        });
      }
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _fcmSubscription?.cancel();
    _socketTicketSubscription?.cancel();
    _socketConnectionSubscription?.cancel();
    super.dispose();
  }

  void _onTap(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  /// Opens the QR scanner — the mandatory entry point for all new complaints.
  /// Camera-only. No gallery. Student cannot manually select location.
  void _openComplaintForm() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => QrScannerScreen(
          ticketService: widget.ticketService,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      StudentHome(
        authService: widget.authService,
        ticketService: widget.ticketService,
        onViewAllTap: () {
          setState(() {
            _selectedIndex = 1;
          });
        },
      ),
      StudentTicketsScreen(ticketService: widget.ticketService),
      StudentNotificationsScreen(
        authService: widget.authService,
        ticketService: widget.ticketService,
      ),
      StudentProfileScreen(
        authService: widget.authService,
        ticketService: widget.ticketService,
        onLogout: () async {
          await widget.authService.logout();
          if (!mounted) return;
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(
              builder: (_) => StartupScreen(
                authService: widget.authService,
                ticketService: widget.ticketService,
              ),
            ),
            (route) => false,
          );
        },
        onGoogleSignOut: () async {
          // Full disconnect: Campus session cleared + Google OAuth grant revoked.
          await widget.authService.logout(fromGoogle: true);
          if (!mounted) return;
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(
              builder: (_) => StartupScreen(
                authService: widget.authService,
                ticketService: widget.ticketService,
              ),
            ),
            (route) => false,
          );
        },
      ),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFF),
      body: IndexedStack(
        index: _selectedIndex,
        children: pages,
      ),
      floatingActionButton: _selectedIndex == 0
          ? FloatingActionButton.extended(
              heroTag: 'student_dashboard_fab',
              onPressed: _openComplaintForm,
              backgroundColor: const Color(0xFF2563EB),
              elevation: 6,
              icon: const Icon(Icons.add_circle_outline_rounded,
                  color: Colors.white),
              label: const Text(
                'Submit Feedback',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            )
          : null,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 20,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _selectedIndex,
          onTap: _onTap,
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          selectedItemColor: const Color(0xFF2563EB),
          unselectedItemColor: Colors.grey.shade400,
          showSelectedLabels: true,
          showUnselectedLabels: true,
          selectedLabelStyle:
              const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
          unselectedLabelStyle:
              const TextStyle(fontWeight: FontWeight.w500, fontSize: 12),
          elevation: 0,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_rounded),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.confirmation_number_rounded),
              label: 'Tickets',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.notifications_rounded),
              label: 'Notifications',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_rounded),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }
}

// ================= HOME DASHBOARD CONTENT =================

class StudentHome extends StatefulWidget {
  final AuthService authService;
  final TicketService ticketService;
  final VoidCallback onViewAllTap;

  const StudentHome({
    super.key,
    required this.authService,
    required this.ticketService,
    required this.onViewAllTap,
  });

  @override
  State<StudentHome> createState() => _StudentHomeState();
}

class _StudentHomeState extends State<StudentHome> {
  bool _isLoading = true;
  String? _errorMessage;

  late String _userName;
  late String _userDepartment;

  int _total = 0;
  int _pending = 0;
  int _inProgress = 0;
  int _resolved = 0;
  List<dynamic> _recentTickets = [];

  final DashboardService _dashboardService = DashboardService();
  StreamSubscription? _socketDashSubscription;

  @override
  void initState() {
    super.initState();
    final user = widget.authService.currentUser;
    _userName = user?.name ?? "";
    _userDepartment = user?.department ?? "";
    _loadData();

    _socketDashSubscription = RealtimeService().dashboardUpdatesStream.listen((update) {
      _loadData(showLoading: false);
    });
  }

  @override
  void dispose() {
    _socketDashSubscription?.cancel();
    super.dispose();
  }

  Future<void> _loadData({bool showLoading = true}) async {
    if (showLoading) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    }
    try {
      final results = await Future.wait([
        widget.ticketService.fetchTickets(limit: 5),
        _dashboardService.fetchStats(),
      ]);

      final all = widget.ticketService.tickets;
      if (mounted) {
        setState(() {
          _recentTickets = all.take(3).toList();
        });
      }

      final stats = results[1] as DashboardStats?;

      if (stats != null) {
        if (mounted) {
          setState(() {
            _total = stats.totalTickets;
            _pending = stats.openTickets;
            _inProgress = stats.inProgressTickets;
            _resolved = stats.resolvedTickets;
            _isLoading = false;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _total = all.length;
            _pending = all.where((t) => t.status == TicketStatus.open).length;
            _inProgress = all.where((t) => 
                t.status == TicketStatus.inProgress || 
                (t.escalationLevel > 1 && t.status != TicketStatus.resolved && t.status != TicketStatus.closed)).length;
            _resolved = all.where((t) =>
                t.status == TicketStatus.resolved ||
                t.status == TicketStatus.closed).length;
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Failed to load dashboard data.';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final resolutionRate =
        _total > 0 ? (_resolved / _total).clamp(0.0, 1.0) : 0.0;
    final resolutionPct = (resolutionRate * 100).round();

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () => _loadData(showLoading: true),
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _errorMessage != null
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: Colors.red),
                        const SizedBox(height: 16),
                        Text(_errorMessage!),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: () => _loadData(showLoading: true),
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  )
                : SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Column(
                      children: [
                        _buildHeader(context),
                        Padding(
                          padding: EdgeInsets.all(AppSpacing.horizontalPad(context)),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildLargeStatCard(context, _total),
                              SizedBox(height: AppSpacing.md(context)),
                              _buildMiniStatsRow(context, _pending, _inProgress, _resolved),
                              SizedBox(height: AppSpacing.lg(context)),
                              _buildSummaryCard(context, _total, _pending, _inProgress,
                                  _resolved, resolutionRate, resolutionPct),
                              SizedBox(height: AppSpacing.lg(context)),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Recent Feedback',
                                    style: TextStyle(
                                      fontSize: AppSpacing.fontSectionHeader(context),
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFF1F2937),
                                    ),
                                  ),
                                  GestureDetector(
                                    onTap: widget.onViewAllTap,
                                    child: Text(
                                      'View All',
                                      style: TextStyle(
                                        fontSize: AppSpacing.fontCardTitle(context) + 2,
                                        fontWeight: FontWeight.w600,
                                        color: const Color(0xFF2563EB),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              SizedBox(height: AppSpacing.md(context)),
                              if (_recentTickets.isEmpty)
                                Center(
                                  child: Padding(
                                    padding: EdgeInsets.all(AppSpacing.md(context)),
                                    child: const Text(
                                      'No feedback found.',
                                      style: TextStyle(color: Colors.grey),
                                    ),
                                  ),
                                )
                              else
                                ..._recentTickets.map((t) => ComplaintCard(
                                       ticket: t,
                                       ticketService: widget.ticketService,
                                     )),
                              // Padding so FAB doesn't cover last card
                              const SizedBox(height: 80),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final hPad = AppSpacing.horizontalPad(context);
    final isCompact = AppSpacing.isCompact(context);
    return Container(
      padding: EdgeInsets.only(
        left: hPad,
        right: hPad,
        top: isCompact ? 18.0 : 24.0,
        bottom: isCompact ? 24.0 : 32.0,
      ),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF1E3A8A), Color(0xFF3B82F6)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Good Morning ☀️',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: AppSpacing.fontCardTitle(context) + 2,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                SizedBox(height: AppSpacing.xs(context)),
                Text(
                  _userName.isNotEmpty ? _userName : 'Student',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: isCompact ? 20.0 : 24.0,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(height: AppSpacing.xs(context)),
                if (_userDepartment.isNotEmpty)
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: isCompact ? 10.0 : 12.0,
                      vertical: isCompact ? 4.0 : 6.0,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _userDepartment,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: AppSpacing.fontCardTitle(context),
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLargeStatCard(BuildContext context, int total) {
    final cp = AppSpacing.cardPadding(context);
    final iconBox = AppSpacing.isCompact(context) ? 48.0 : 60.0;
    final iconSize = AppSpacing.isCompact(context) ? 28.0 : 34.0;
    return Container(
      padding: cp,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF2563EB), Color(0xFF60A5FA)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppSpacing.radiusXL(context)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2563EB).withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Total Feedback Submitted',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: AppSpacing.fontCardTitle(context) + 2,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                SizedBox(height: AppSpacing.xs(context)),
                Text(
                  '$total',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: AppSpacing.fontDisplay(context),
                    fontWeight: FontWeight.w900,
                    height: 1,
                    letterSpacing: -2,
                  ),
                ),
                SizedBox(height: AppSpacing.sm(context)),
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: AppSpacing.isCompact(context) ? 10.0 : 12.0,
                    vertical: AppSpacing.isCompact(context) ? 4.0 : 6.0,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'Active This Month',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: AppSpacing.fontCardTitle(context),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: iconBox,
            height: iconBox,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
            ),
            child: Icon(
              Icons.confirmation_number_rounded,
              color: Colors.white,
              size: iconSize,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniStatsRow(BuildContext context, int pending, int inProgress, int resolved) {
    return Row(
      children: [
        Expanded(
          child: _StatCardWidget(
            title: 'Pending',
            count: '$pending',
            icon: Icons.hourglass_empty_rounded,
            color: const Color(0xFFEA580C),
            bgColor: const Color(0xFFFFF7ED),
          ),
        ),
        SizedBox(width: AppSpacing.sm(context)),
        Expanded(
          child: _StatCardWidget(
            title: 'In Progress',
            count: '$inProgress',
            icon: Icons.autorenew_rounded,
            color: const Color(0xFF2563EB),
            bgColor: const Color(0xFFEFF6FF),
          ),
        ),
        SizedBox(width: AppSpacing.sm(context)),
        Expanded(
          child: _StatCardWidget(
            title: 'Resolved',
            count: '$resolved',
            icon: Icons.check_circle_outline_rounded,
            color: const Color(0xFF16A34A),
            bgColor: const Color(0xFFDCFCE7),
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryCard(BuildContext context, int total, int pending, int inProgress, int resolved,
      double resolutionRate, int resolutionPct) {
    final cp = AppSpacing.cardPadding(context);
    final md = AppSpacing.md(context);
    final lg = AppSpacing.lg(context);
    return Container(
      padding: cp,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusXL(context)),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.bar_chart_rounded,
                  color: const Color(0xFF2563EB),
                  size: AppSpacing.iconMd(context)),
              SizedBox(width: AppSpacing.sm(context)),
              Text(
                'Dashboard Summary',
                style: TextStyle(
                  fontSize: AppSpacing.fontSectionHeader(context),
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF111827),
                ),
              ),
            ],
          ),
          SizedBox(height: md),
          Divider(color: Colors.grey.shade200, height: 1),
          SizedBox(height: md),
          _SummaryRowWidget(
            title: 'Total Feedback',
            count: '$total',
            icon: Icons.receipt_long_rounded,
            color: const Color(0xFF2563EB),
            bgColor: const Color(0xFFEFF6FF),
          ),
          SizedBox(height: md),
          _SummaryRowWidget(
            title: 'Pending',
            count: '$pending',
            icon: Icons.hourglass_empty_rounded,
            color: const Color(0xFFEA580C),
            bgColor: const Color(0xFFFFF7ED),
          ),
          SizedBox(height: md),
          _SummaryRowWidget(
            title: 'In Progress',
            count: '$inProgress',
            icon: Icons.autorenew_rounded,
            color: const Color(0xFF2563EB),
            bgColor: const Color(0xFFEFF6FF),
          ),
          SizedBox(height: md),
          _SummaryRowWidget(
            title: 'Resolved',
            count: '$resolved',
            icon: Icons.check_circle_outline_rounded,
            color: const Color(0xFF16A34A),
            bgColor: const Color(0xFFDCFCE7),
          ),
          SizedBox(height: lg),
          Divider(color: Colors.grey.shade200, height: 1),
          SizedBox(height: lg),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Resolution Rate',
                style: TextStyle(
                  fontSize: AppSpacing.fontCardTitle(context) + 2,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFF6B7280),
                ),
              ),
              Text(
                '$resolutionPct%',
                style: TextStyle(
                  fontSize: AppSpacing.fontSectionHeader(context) + 2,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF16A34A),
                ),
              ),
            ],
          ),
          SizedBox(height: AppSpacing.sm(context)),
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: LinearProgressIndicator(
              value: resolutionRate,
              minHeight: 8,
              backgroundColor: const Color(0xFFDCFCE7),
              valueColor:
                  const AlwaysStoppedAnimation<Color>(Color(0xFF16A34A)),
            ),
          ),
        ],
      ),
    );
  }
}

// Reusable Stat Card Widget
class _StatCardWidget extends StatelessWidget {
  final String title;
  final String count;
  final IconData icon;
  final Color color;
  final Color bgColor;

  const _StatCardWidget({
    super.key,
    required this.title,
    required this.count,
    required this.icon,
    required this.color,
    required this.bgColor,
  });

  @override
  Widget build(BuildContext context) {
    final compact = AppSpacing.isCompact(context);
    final iconPad = compact ? 8.0 : 10.0;
    return Container(
      padding: EdgeInsets.symmetric(
        vertical: compact ? 12.0 : 16.0,
        horizontal: compact ? 10.0 : 12.0,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: EdgeInsets.all(iconPad),
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(compact ? 10.0 : 14.0),
            ),
            child: Icon(icon, color: color, size: AppSpacing.iconSm(context)),
          ),
          SizedBox(height: AppSpacing.sm(context)),
          Text(
            count,
            style: TextStyle(
              fontSize: AppSpacing.fontStatCount(context),
              fontWeight: FontWeight.w900,
              color: color,
              height: 1,
            ),
          ),
          SizedBox(height: AppSpacing.xs(context)),
          Text(
            title,
            style: TextStyle(
              fontSize: AppSpacing.fontCardTitle(context),
              fontWeight: FontWeight.w600,
              color: const Color(0xFF6B7280),
            ),
          ),
        ],
      ),
    );
  }
}

// Reusable Summary Row Widget
class _SummaryRowWidget extends StatelessWidget {
  final String title;
  final String count;
  final IconData icon;
  final Color color;
  final Color bgColor;

  const _SummaryRowWidget({
    super.key,
    required this.title,
    required this.count,
    required this.icon,
    required this.color,
    required this.bgColor,
  });

  @override
  Widget build(BuildContext context) {
    final compact = AppSpacing.isCompact(context);
    final boxSize = compact ? 34.0 : 40.0;
    return Row(
      children: [
        Container(
          width: boxSize,
          height: boxSize,
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
          ),
          child: Icon(icon, color: color, size: AppSpacing.iconSm(context)),
        ),
        SizedBox(width: AppSpacing.md(context)),
        Expanded(
          child: Text(
            title,
            style: TextStyle(
              fontSize: AppSpacing.fontCardTitle(context) + 3,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF4B5563),
            ),
          ),
        ),
        Text(
          count,
          style: TextStyle(
            fontSize: AppSpacing.fontSectionHeader(context) + 2,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
      ],
    );
  }
}