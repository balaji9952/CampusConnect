import 'package:flutter/material.dart';
import 'package:campus_connect/config/api_config.dart';
import 'package:campus_connect/utils/url_helper.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/screens/common/notification_settings_screen.dart';
import 'package:campus_connect/services/api_service.dart';

class StudentProfileScreen extends StatefulWidget {
  final AuthService authService;
  final TicketService ticketService;

  final VoidCallback? onLogout;

  /// Full Google disconnect (revoke) + Campus logout.
  final VoidCallback? onGoogleSignOut;

  const StudentProfileScreen({
    Key? key,
    required this.authService,
    required this.ticketService,
    this.onLogout,
    this.onGoogleSignOut,
  }) : super(key: key);

  @override
  State<StudentProfileScreen> createState() => _StudentProfileScreenState();
}

class _StudentProfileScreenState extends State<StudentProfileScreen> {
  // Profile data state — read-only display
  late String _fullName;
  late String _email;

  late String _rollNo;
  late String _programType;
  late String _branch;
  late String _year;
  late String _department;

  // Options (kept for reference display — not user-editable)
  final List<String> _programTypes = ['UG', 'PG'];

  String get _initials {
    final parts = _fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  @override
  void initState() {
    super.initState();
    final user = widget.authService.currentUser;
    _fullName = user?.name ?? '';
    _email = user?.email ?? '';

    _rollNo = user?.rollNo ?? '';
    _programType = user?.programType ?? 'UG';
    _branch = user?.branch ?? 'B.E';
    _year = user?.year ?? '1st Year';
    _department = user?.department ?? 'Computer Science Engineering';
  }

  Future<void> _refreshProfile() async {
    final success = await widget.authService.syncProfile();
    if (success && mounted) {
      final user = widget.authService.currentUser;
      if (user != null) {
        setState(() {
          _fullName = user.name;
          _email = user.email;

          _rollNo = user.rollNo ?? '';
          _programType = user.programType ?? 'UG';
          _branch = user.branch ?? 'B.E';
          _year = user.year ?? '1st Year';
          _department = user.department ?? '';
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Profile refreshed successfully', style: TextStyle(fontWeight: FontWeight.w500)),
            backgroundColor: const Color(0xFF16A34A),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final hPad = AppSpacing.horizontalPad(context);
    return Container(
      color: const Color(0xFFF5F6FA),
      child: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refreshProfile,
          color: const Color(0xFF2563EB),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Top Bar — title only, no edit button
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: hPad, vertical: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'Profile',
                        style: TextStyle(
                          fontSize: AppSpacing.isCompact(context) ? 20.0 : 24.0,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF111827),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 12),

                // ── Profile Avatar (display only — no photo upload) ──────────
                Builder(
                  builder: (context) {
                    final outerSize = AppSpacing.profileRadius(context) * 2.12;
                    final innerSize = outerSize - 6;

                    // Use cached avatar URL from AuthService
                    ImageProvider? avatarProvider;
                    if (widget.authService.currentUser?.avatarUrl != null &&
                        widget.authService.currentUser!.avatarUrl!.isNotEmpty) {
                      avatarProvider = NetworkImage(
                        UrlHelper.resolveImageUrl(widget.authService.currentUser!.avatarUrl!),
                      );
                    }

                    return Container(
                      width: outerSize,
                      height: outerSize,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [Color(0xFF2563EB), Color(0xFF60A5FA)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF2563EB).withValues(alpha: 0.30),
                            blurRadius: 20,
                            spreadRadius: 2,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(3),
                        child: Container(
                          decoration: const BoxDecoration(
                            color: Color(0xFFEFF6FF),
                            shape: BoxShape.circle,
                          ),
                          child: ClipOval(
                            child: avatarProvider != null
                                ? Image(
                                    image: avatarProvider,
                                    fit: BoxFit.cover,
                                    width: innerSize,
                                    height: innerSize,
                                  )
                                : Center(
                                    child: Text(
                                      _initials,
                                      style: TextStyle(
                                        fontSize: outerSize * 0.33,
                                        fontWeight: FontWeight.w800,
                                        color: const Color(0xFF2563EB),
                                      ),
                                    ),
                                  ),
                          ),
                        ),
                      ),
                    );
                  },
                ),

                SizedBox(height: AppSpacing.lg(context)),

                // Info Section Title
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: hPad),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Personal Information',
                      style: TextStyle(
                        fontSize: AppSpacing.fontCardTitle(context),
                        fontWeight: FontWeight.w700,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ),
                ),
                SizedBox(height: AppSpacing.md(context)),

                // Cards
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: hPad),
                  child: Column(
                    children: [
                      _ProfileInfoCard(
                        icon: Icons.person_rounded,
                        label: 'Full Name',
                        value: _fullName,
                      ),
                      SizedBox(height: AppSpacing.sm(context)),
                      _ProfileInfoCard(
                        icon: Icons.badge_rounded,
                        label: 'Register Number',
                        value: _rollNo,
                      ),
                      SizedBox(height: AppSpacing.sm(context)),
                      _ProfileInfoCard(
                        icon: Icons.email_rounded,
                        label: 'Email Address',
                        value: _email,
                      ),
                      SizedBox(height: AppSpacing.lg(context)),

                      // Academic Info Title
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Academic Information',
                          style: TextStyle(
                            fontSize: AppSpacing.fontCardTitle(context) + 2,
                            fontWeight: FontWeight.w700,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ),
                      SizedBox(height: AppSpacing.md(context)),

                      // Academic fields — always read-only
                      _ProfileInfoCard(
                        icon: Icons.school_rounded,
                        label: 'Program Type',
                        value: _programType,
                      ),
                      SizedBox(height: AppSpacing.sm(context)),
                      _ProfileInfoCard(
                        icon: Icons.menu_book_rounded,
                        label: 'Branch',
                        value: _branch,
                      ),
                      SizedBox(height: AppSpacing.sm(context)),
                      _ProfileInfoCard(
                        icon: Icons.calendar_today_rounded,
                        label: 'Year',
                        value: _year,
                      ),
                      SizedBox(height: AppSpacing.sm(context)),
                      _ProfileInfoCard(
                        icon: Icons.business_rounded,
                        label: 'Department',
                        value: _department,
                      ),
                      SizedBox(height: AppSpacing.lg(context)),

                      // Notification Settings
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => NotificationSettingsScreen(apiService: ApiService()),
                              ),
                            );
                          },
                          icon: Icon(Icons.notifications_active_outlined, color: const Color(0xFF2563EB), size: AppSpacing.iconSm(context) + 2),
                          label: Text(
                            'Notification Settings',
                            style: TextStyle(
                              fontSize: AppSpacing.fontSectionHeader(context),
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF2563EB),
                            ),
                          ),
                          style: OutlinedButton.styleFrom(
                            padding: EdgeInsets.symmetric(vertical: AppSpacing.md(context)),
                            side: const BorderSide(color: Color(0xFF2563EB), width: 1.5),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
                            ),
                          ),
                        ),
                      ),
                      SizedBox(height: AppSpacing.md(context)),

                      // Sign Out
                      SizedBox(
                        width: double.infinity,
                        child: TextButton.icon(
                          onPressed: () async {
                            if (widget.onLogout != null) {
                              widget.onLogout!();
                            } else {
                              await widget.authService.logout();
                            }
                          },
                          icon: Icon(Icons.logout_rounded, color: Colors.redAccent, size: AppSpacing.iconSm(context) + 2),
                          label: Text(
                            'Sign Out',
                            style: TextStyle(
                              fontSize: AppSpacing.fontSectionHeader(context),
                              fontWeight: FontWeight.w700,
                              color: Colors.redAccent,
                            ),
                          ),
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.symmetric(vertical: AppSpacing.md(context)),
                            backgroundColor: Colors.red.shade50,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
                            ),
                          ),
                        ),
                      ),
                      SizedBox(height: AppSpacing.sm(context)),

                      // Sign out from Google
                      SizedBox(
                        width: double.infinity,
                        child: TextButton.icon(
                          onPressed: () async {
                            final confirmed = await showDialog<bool>(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Row(
                                  children: [
                                    Icon(Icons.privacy_tip_outlined, color: Color(0xFFEF4444)),
                                    SizedBox(width: 8),
                                    Text('Sign out from Google?'),
                                  ],
                                ),
                                content: const Text(
                                  'This will remove Campus Connect\'s access to your Google account on this device. '
                                  'You\'ll need to grant permission again — and may be asked for your Google password — '
                                  'the next time you sign in.',
                                  style: TextStyle(height: 1.4),
                                ),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.pop(ctx, false),
                                    child: const Text('Cancel'),
                                  ),
                                  TextButton(
                                    onPressed: () => Navigator.pop(ctx, true),
                                    style: TextButton.styleFrom(foregroundColor: Colors.redAccent),
                                    child: const Text('Sign out from Google'),
                                  ),
                                ],
                              ),
                            );
                            if (confirmed == true) {
                              if (widget.onGoogleSignOut != null) {
                                widget.onGoogleSignOut!();
                              } else {
                                await widget.authService.logout(fromGoogle: true);
                              }
                            }
                          },
                          icon: Icon(Icons.gpp_maybe_outlined, color: Colors.grey.shade700, size: AppSpacing.iconSm(context) + 2),
                          label: Text(
                            'Sign out from Google',
                            style: TextStyle(
                              fontSize: AppSpacing.fontCardTitle(context),
                              fontWeight: FontWeight.w600,
                              color: Colors.grey.shade700,
                            ),
                          ),
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.symmetric(vertical: AppSpacing.sm(context) + 2),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
                            ),
                          ),
                        ),
                      ),

                      SizedBox(height: AppSpacing.xl(context)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfileInfoCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _ProfileInfoCard({
    Key? key,
    required this.icon,
    required this.label,
    required this.value,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final compact = AppSpacing.isCompact(context);
    final boxSize = compact ? 36.0 : 44.0;
    return Container(
      padding: EdgeInsets.all(AppSpacing.md(context)),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: boxSize,
            height: boxSize,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
            ),
            child: Icon(icon, color: const Color(0xFF2563EB), size: AppSpacing.iconSm(context)),
          ),
          SizedBox(width: AppSpacing.md(context)),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: AppSpacing.fontCardTitle(context) - 1,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade500,
                  ),
                ),
                SizedBox(height: AppSpacing.xs(context) / 2),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: AppSpacing.fontCardTitle(context) + 2,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF111827),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
