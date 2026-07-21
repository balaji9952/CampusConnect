import 'package:flutter/material.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/services/ticket_service.dart';

class CommonBottomNav extends StatelessWidget {
  final int currentIndex;
  final AuthService authService;
  final TicketService ticketService;
  final Function(int)? onTap;

  const CommonBottomNav({
    super.key,
    required this.currentIndex,
    required this.authService,
    required this.ticketService,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(13),
            blurRadius: 20,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _navItem(context, Icons.home_rounded, 'Dashboard', 0),
              _navItem(context, Icons.receipt_long_rounded, 'Complaints', 1),
              _navItem(
                context,
                Icons.notifications_rounded,
                'Notifications',
                2,
                badge: ticketService.unreadNotificationCount,
              ),
              _navItem(context, Icons.person_rounded, 'Profile', 3),
            ],
          ),
        ),
      ),
    );
  }

  Widget _navItem(BuildContext context, IconData icon, String label, int index, {int badge = 0}) {
    final isSelected = currentIndex == index;
    final primaryColor = const Color(0xFF0057FF);

    return GestureDetector(
      onTap: () {
        if (onTap != null) onTap!(index);
      },
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: EdgeInsets.symmetric(
          vertical: 6,
          horizontal: AppSpacing.isCompact(context) ? 8.0 : 12.0,
        ),
        decoration: BoxDecoration(
          color: isSelected ? primaryColor.withAlpha(26) : Colors.transparent,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon,
                    color: isSelected ? primaryColor : Colors.grey.shade400,
                    size: AppSpacing.iconMd(context)),
                if (badge > 0)
                  Positioned(
                    right: -8,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(
                        color: Colors.red,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        badge > 9 ? '9+' : '$badge',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: AppSpacing.fontBadge(context),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? primaryColor : Colors.grey.shade500,
                fontSize: AppSpacing.fontNavLabel(context),
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
