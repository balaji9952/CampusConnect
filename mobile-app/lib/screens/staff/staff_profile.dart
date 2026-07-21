import 'package:flutter/material.dart';
import 'package:campus_connect/config/api_config.dart';
import 'package:campus_connect/utils/url_helper.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/screens/common/notification_settings_screen.dart';
import 'package:campus_connect/services/api_service.dart';

class ProfileScreen extends StatefulWidget {
  final VoidCallback? onLogout;
  final VoidCallback? onGoogleSignOut;
  final String initialName;
  final String initialDepartment;
  final String initialPosition;
  final void Function(String name, String department, String position)? onProfileUpdated;
  final AuthService? authService;

  const ProfileScreen({
    Key? key,
    this.onLogout,
    this.onGoogleSignOut,
    this.initialName = '',
    this.initialDepartment = '',
    this.initialPosition = '',
    this.onProfileUpdated,
    this.authService,
  }) : super(key: key);

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  // Profile data state — read-only display
  late String _fullName;
  late String _staffId;
  late String _email;
  late String _department;
  late String _position;

  String get _initials {
    final parts = _fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  @override
  void initState() {
    super.initState();
    final user = widget.authService?.currentUser;
    _fullName = widget.initialName.isNotEmpty
        ? widget.initialName
        : (user?.name ?? '');
    _department = widget.initialDepartment.isNotEmpty
        ? widget.initialDepartment
        : (user?.department ?? '');
    _position = widget.initialPosition.isNotEmpty
        ? widget.initialPosition
        : (user?.designation ?? '');
    _staffId = user?.rollNo ?? '';
    _email = user?.email ?? '';
  }

  Future<void> _refreshProfile() async {
    if (widget.authService != null) {
      final success = await widget.authService!.syncProfile();
      if (success && mounted) {
        final user = widget.authService!.currentUser;
        if (user != null) {
          setState(() {
            _fullName = user.name;
            _staffId = user.rollNo ?? '';
            _email = user.email;
            _department = user.department ?? '';
            _position = user.designation ?? '';
          });
          widget.onProfileUpdated?.call(_fullName, _department, _position);
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

                    ImageProvider? avatarProvider;
                    if (widget.authService?.currentUser?.avatarUrl != null &&
                        widget.authService!.currentUser!.avatarUrl!.isNotEmpty) {
                      avatarProvider = NetworkImage(
                        UrlHelper.resolveImageUrl(widget.authService!.currentUser!.avatarUrl!),
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
                      'Account Information',
                      style: TextStyle(
                        fontSize: AppSpacing.fontCardTitle(context) + 2,
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
                        label: 'Staff ID',
                        value: _staffId,
                      ),
                      SizedBox(height: AppSpacing.sm(context)),
                      _ProfileInfoCard(
                        icon: Icons.email_rounded,
                        label: 'Email Address',
                        value: _email,
                      ),
                      SizedBox(height: AppSpacing.sm(context)),
                      _ProfileInfoCard(
                        icon: Icons.school_rounded,
                        label: 'Department',
                        value: _department,
                      ),
                      SizedBox(height: AppSpacing.sm(context)),
                      _ProfileInfoCard(
                        icon: Icons.workspace_premium_rounded,
                        label: 'Position',
                        value: _position,
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
                          onPressed: widget.onLogout,
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
                                widget.onLogout?.call();
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
    final boxSize = AppSpacing.isCompact(context) ? 36.0 : 44.0;
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
            child: Icon(icon, color: const Color(0xFF2563EB), size: boxSize * 0.5),
          ),
          SizedBox(width: AppSpacing.md(context)),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: AppSpacing.fontCardTitle(context) - 2,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade500,
                  ),
                ),
                SizedBox(height: AppSpacing.xs(context) / 2),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: AppSpacing.fontCardTitle(context) + 1,
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
