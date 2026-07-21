import 'package:flutter/material.dart';
import 'package:campus_connect/utils/app_colors.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/screens/common/startup_screen.dart';

/// Reusable avatar button with a popup menu.
/// Shows "Sign Out" and "Sign out from Google" options.
class ProfileAvatarButton extends StatelessWidget {
  final AuthService authService;
  final TicketService ticketService;

  /// Called when the user explicitly chooses "Sign out from Google".
  final VoidCallback? onGoogleSignOut;

  const ProfileAvatarButton({
    super.key,
    required this.authService,
    required this.ticketService,
    this.onGoogleSignOut,
  });

  @override
  Widget build(BuildContext context) {
    final user = authService.currentUser;
    final initials = user?.initials ?? '?';

    return PopupMenuButton<_ProfileAction>(
      offset: const Offset(0, 56),
      color: AppColors.bgCard,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: AppColors.border),
      ),
      elevation: 12,
      onSelected: (action) => _handleAction(context, action),
      itemBuilder: (_) => [
        // ── Header item (non-interactive) ─────────────────────────────
        PopupMenuItem<_ProfileAction>(
          enabled: false,
          padding: EdgeInsets.zero,
          child: Container(
            padding: EdgeInsets.fromLTRB(AppSpacing.md(context), AppSpacing.sm(context) + 2, AppSpacing.md(context), AppSpacing.sm(context)),
            child: Row(
              children: [
                Builder(
                  builder: (context) {
                    final sz = AppSpacing.isCompact(context) ? 34.0 : 40.0;
                    return Container(
                      width: sz,
                      height: sz,
                      decoration: BoxDecoration(
                        gradient: AppColors.primaryGradient,
                        borderRadius: BorderRadius.circular(sz * 0.32),
                      ),
                      child: Center(
                        child: Text(
                          initials,
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: sz * 0.4,
                          ),
                        ),
                      ),
                    );
                  },
                ),
                SizedBox(width: AppSpacing.sm(context)),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.name ?? 'User',
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w700,
                          fontSize: AppSpacing.fontCardTitle(context) - 1,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        user?.roleLabel ?? '',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: AppSpacing.fontCardTitle(context) - 3),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),

        // Divider
        PopupMenuItem<_ProfileAction>(
          enabled: false,
          height: 1,
          padding: EdgeInsets.zero,
          child: Divider(
            color: AppColors.border,
            height: 1,
          ),
        ),



        // ── Sign Out ──────────────────────────────────────────────────
        _menuItem(
          context: context,
          value: _ProfileAction.logout,
          icon: Icons.logout_rounded,
          label: 'Sign Out',
          color: AppColors.accent,
        ),
        // ── Sign out from Google ────────────────────────────────────────
        _menuItem(
          context: context,
          value: _ProfileAction.signOutFromGoogle,
          icon: Icons.gpp_maybe_outlined,
          label: 'Sign out from Google',
          color: Colors.grey.shade600,
        ),
      ],
      // ── The avatar trigger ───────────────────────────────────────────────
      child: Builder(
        builder: (context) {
          final size = AppSpacing.avatarSm(context);
          final fontSize = size * 0.375;
          return Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              gradient: AppColors.primaryGradient,
              borderRadius: BorderRadius.circular(size * 0.33),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.3),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Center(
              child: Text(
                initials,
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: fontSize,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  PopupMenuItem<_ProfileAction> _menuItem({
    required BuildContext context,
    required _ProfileAction value,
    required IconData icon,
    required String label,
    required Color color,
  }) {
    return PopupMenuItem<_ProfileAction>(
      value: value,
      padding: EdgeInsets.zero,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: AppSpacing.md(context), vertical: AppSpacing.sm(context) - 2),
        child: Row(
          children: [
            Container(
              width: AppSpacing.isCompact(context) ? 28 : 32,
              height: AppSpacing.isCompact(context) ? 28 : 32,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: AppSpacing.iconSm(context) - 1),
            ),
            SizedBox(width: AppSpacing.sm(context)),
            Text(
              label,
              style: TextStyle(
                color: value == _ProfileAction.logout ? color : AppColors.textPrimary,
                fontSize: AppSpacing.fontCardTitle(context),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleAction(BuildContext context, _ProfileAction action) async {
    switch (action) {
      case _ProfileAction.logout:
        await authService.logout();
        if (context.mounted) {
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(
              builder: (_) => StartupScreen(
                authService: authService,
                ticketService: ticketService,
              ),
            ),
            (route) => false,
          );
        }
        break;

      case _ProfileAction.signOutFromGoogle:
        await authService.logout(fromGoogle: true);
        if (context.mounted) {
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(
              builder: (_) => StartupScreen(
                authService: authService,
                ticketService: ticketService,
              ),
            ),
            (route) => false,
          );
        }
        break;
    }
  }
}

enum _ProfileAction { logout, signOutFromGoogle }
