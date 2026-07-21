import 'dart:async';
import 'package:flutter/material.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/services/api_service.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/services/dashboard_service.dart';
import 'package:campus_connect/models/ticket.dart';
import 'package:campus_connect/services/fcm_service.dart';
import 'package:campus_connect/screens/common/startup_screen.dart';
import 'package:campus_connect/screens/common/qr_scanner_screen.dart';

import 'package:campus_connect/screens/staff/staff_tickets.dart';
import 'package:campus_connect/screens/staff/staff_notification.dart';
import 'package:campus_connect/screens/staff/staff_profile.dart';
import 'package:campus_connect/services/realtime_service.dart';
import 'package:campus_connect/screens/staff/principal_executive_section.dart';

/// Roles that are allowed to submit complaints.
const List<String> _complaintEligibleRoles = [
  'Assistant Professor',
  'Associate Professor',
  'Lecturer',
  'Senior Lecturer',
  'Lab Assistant',
  'Lab Technician',
  'Placement Officer',
  'Department Coordinator',
  'Exam Cell Coordinator',
  'Hostel Warden Boys',
  'Hostel Warden Girls',
  'Mess Warden Boys',
  'Mess Warden Girls',
  'Canteen Head',
  'HOD',
  'Head of Department (HOD)',
  'Dean',
];

bool _canSubmitComplaint(String position) =>
    position.isEmpty || _complaintEligibleRoles.contains(position);

class StaffDashboard extends StatefulWidget {
  final AuthService authService;
  final TicketService ticketService;

  const StaffDashboard({
    Key? key,
    required this.authService,
    required this.ticketService,
  }) : super(key: key);

  @override
  State<StaffDashboard> createState() => _StaffDashboardState();
}

class _StaffDashboardState extends State<StaffDashboard> {
  int _selectedIndex = 0;

  // Real profile data from AuthService — no more hardcoded defaults
  late String _profileName;
  late String _profileDepartment;
  late String _profilePosition;

  StreamSubscription? _fcmSubscription;
  StreamSubscription? _socketTicketSubscription;
  StreamSubscription? _socketConnectionSubscription;

  // Shared notifications list — passed to NotificationsScreen
  final List<Map<String, dynamic>> _staffNotifications = [];

  @override
  void initState() {
    super.initState();
    final user = widget.authService.currentUser;
    _profileName = user?.name ?? '';
    _profileDepartment = user?.department ?? '';
    _profilePosition = user?.designation ?? '';
    
    // Fetch fresh profile from backend to sync admin edits
    _refreshProfile();

    _fcmSubscription = FCMService().onForegroundMessage.listen((_) {
      debugPrint('[StaffDashboard] Foreground FCM message received (handled by Socket)');
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

  Future<void> _refreshProfile() async {
    try {
      final response = await ApiService().get('/users/me');
      if (response != null && response['success'] == true) {
        if (mounted) {
          setState(() {
            _profileName = response['data']['name'] ?? _profileName;
            _profileDepartment = response['data']['department'] ?? _profileDepartment;
            _profilePosition = response['data']['designation'] ?? _profilePosition;
          });
        }
      }
    } catch (e) {
      debugPrint('Failed to refresh profile: $e');
    }
  }

  void _onProfileUpdated(String name, String department, String position) {
    setState(() {
      _profileName = name;
      _profileDepartment = department;
      _profilePosition = position;
    });
  }

  void _onTap(int index) {
    setState(() {
      _selectedIndex = index;
    });
    if (index == 1) {
      widget.ticketService.fetchTickets(limit: 50).then((_) {
        if (mounted) setState(() {});
      });
    }
  }

  void _openComplaintForm() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => QrScannerScreen(
          ticketService: widget.ticketService,
        ),
      ),
    ).then((_) {
      setState(() {});
    });
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      DashboardScreen(
        staffName: _profileName,
        staffDepartment: _profileDepartment,
        staffPosition: _profilePosition,
        ticketService: widget.ticketService,
      ),
      TicketsScreen(
        staffPosition: _profilePosition,
        staffName: _profileName,
        ticketService: widget.ticketService,
        complaints: widget.ticketService.tickets,
        notifications: _staffNotifications,
        onComplaintsChanged: () async {
          await widget.ticketService.fetchTickets(limit: 50);
          if (mounted) setState(() {});
        },
      ),
      StaffNotificationsScreen(
        ticketService: widget.ticketService,
        staffPosition: _profilePosition,
        staffName: _profileName,
      ),
      ProfileScreen(
        initialName: _profileName,
        initialDepartment: _profileDepartment,
        initialPosition: _profilePosition,
        authService: widget.authService,
        onProfileUpdated: _onProfileUpdated,
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

    final showFab =
        _selectedIndex == 0 && _canSubmitComplaint(_profilePosition);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFF),
      body: IndexedStack(
        index: _selectedIndex,
        children: pages,
      ),
      floatingActionButton: showFab
          ? FloatingActionButton.extended(
              heroTag: 'staff_dashboard_fab',
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

class DashboardScreen extends StatefulWidget {
  final String staffName;
  final String staffDepartment;
  final String staffPosition;
  final TicketService ticketService;

  const DashboardScreen({
    Key? key,
    required this.staffName,
    required this.staffDepartment,
    required this.staffPosition,
    required this.ticketService,
  }) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _isLoading = true;
  String? _errorMessage;

  // Authoritative counts from GET /api/dashboard/stats
  int _total = 0;
  int _pending = 0;
  int _inProgress = 0;
  int _resolved = 0;
  int _level1 = 0;
  int _level2 = 0;
  int _level3 = 0;
  int _escalated = 0;
  
  PrincipalExecutiveData? _principalExecutiveData;

  final DashboardService _dashboardService = DashboardService();

  StreamSubscription? _socketDashSubscription;

  @override
  void initState() {
    super.initState();
    _loadData();

    _socketDashSubscription = RealtimeService().dashboardUpdatesStream.listen((update) {
      // Just reload data silently for dashboard deltas.
      // We could manually apply deltas, but fetching dashboard is very cheap.
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
      // Fetch stats and tickets concurrently (limit: 5 is enough for stats fallback/recent list)
      final results = await Future.wait([
        widget.ticketService.fetchTickets(limit: 5),
        _dashboardService.fetchStats(),
      ]);

      // Fetch authoritative counts from the backend dashboard endpoint
      final stats = results[1] as DashboardStats?;

      debugPrint('STAFF DASHBOARD RESPONSE: $stats');

      if (stats != null) {
        debugPrint('STAFF STATS: total=${stats.totalTickets} open=${stats.openTickets} inProgress=${stats.inProgressTickets} resolved=${stats.resolvedTickets}');
        if (mounted) {
          setState(() {
            _total = stats.totalTickets;
            _pending = stats.openTickets;
            _inProgress = stats.inProgressTickets;
            _resolved = stats.resolvedTickets;
            _level1 = stats.level1Tickets;
            _level2 = stats.level2Tickets;
            _level3 = stats.level3Tickets;
            _escalated = stats.escalatedTickets;
            _principalExecutiveData = stats.principalExecutiveData;
            _isLoading = false;
          });
        }
      } else {
        // Fallback: derive counts from the locally fetched ticket list
        debugPrint('STAFF DASHBOARD: stats API returned null — falling back to local ticket list');
        final all = widget.ticketService.tickets;
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
            _level1 = all.where((t) => t.escalationLevel == 1).length;
            _level2 = all.where((t) => t.escalationLevel == 2).length;
            _level3 = all.where((t) => t.escalationLevel == 3).length;
            _escalated = all.where((t) => t.escalationLevel > 1).length;
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      debugPrint('STAFF DASHBOARD ERROR: $e');
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
        onRefresh: _loadData,
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
                          onPressed: _loadData,
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
                        if (widget.staffPosition.toLowerCase() == 'principal')
                          PrincipalExecutiveSection(
                            data: _principalExecutiveData,
                            isLoading: _isLoading,
                            onRefresh: () async { await _loadData(); },
                          )
                        else ...[
                          _buildHeader(context),
                          Padding(
                            padding: EdgeInsets.all(AppSpacing.horizontalPad(context)),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                _buildLargeStatCard(context, _total),
                                SizedBox(height: AppSpacing.md(context)),
                                _buildMiniStatsRow(context, _pending, _inProgress, _resolved),
                              SizedBox(height: AppSpacing.lg(context)),
                              _buildSummaryCard(context, _total, _pending, _inProgress,
                              _resolved, resolutionRate, resolutionPct),
                              SizedBox(height: AppSpacing.lg(context)),
                              _buildEscalationStatsRow(context),
                            ],
                          ),
                        ),
                      ],
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
                  widget.staffName.isNotEmpty ? widget.staffName : 'Staff Member',
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
                if (widget.staffPosition.isNotEmpty || widget.staffDepartment.isNotEmpty)
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
                      [widget.staffPosition, widget.staffDepartment]
                          .where((s) => s.isNotEmpty)
                          .join(' • '),
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
                  'Total Feedback Assigned',
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

  Widget _buildEscalationStatsRow(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Escalation Levels',
          style: TextStyle(
            fontSize: AppSpacing.fontSectionHeader(context),
            fontWeight: FontWeight.bold,
            color: const Color(0xFF1F2937),
          ),
        ),
        SizedBox(height: AppSpacing.md(context)),
        Row(
          children: [
            Expanded(
              child: _StatCardWidget(
                title: 'Level 1',
                count: '$_level1',
                icon: Icons.looks_one_rounded,
                color: const Color(0xFF2563EB),
                bgColor: const Color(0xFFEFF6FF),
              ),
            ),
            SizedBox(width: AppSpacing.sm(context)),
            Expanded(
              child: _StatCardWidget(
                title: 'Level 2',
                count: '$_level2',
                icon: Icons.looks_two_rounded,
                color: const Color(0xFF7C3AED),
                bgColor: const Color(0xFFF3E8FF),
              ),
            ),
            SizedBox(width: AppSpacing.sm(context)),
            Expanded(
              child: _StatCardWidget(
                title: 'Level 3',
                count: '$_level3',
                icon: Icons.looks_3_rounded,
                color: const Color(0xFFDC2626),
                bgColor: const Color(0xFFFEF2F2),
              ),
            ),
          ],
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
              const Text(
                'Resolution Rate',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF6B7280),
                ),
              ),
              Text(
                '$resolutionPct%',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF16A34A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
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
    Key? key,
    required this.title,
    required this.count,
    required this.icon,
    required this.color,
    required this.bgColor,
  }) : super(key: key);

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
    Key? key,
    required this.title,
    required this.count,
    required this.icon,
    required this.color,
    required this.bgColor,
  }) : super(key: key);

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