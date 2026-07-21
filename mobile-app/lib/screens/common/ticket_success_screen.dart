import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:campus_connect/utils/app_colors.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/models/ticket.dart';
import 'package:campus_connect/services/ticket_service.dart';

class TicketSuccessScreen extends StatelessWidget {
  final Ticket ticket;
  final TicketService ticketService;
  const TicketSuccessScreen({super.key, required this.ticket, required this.ticketService});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(AppSpacing.horizontalPad(context)),
          child: Column(
              children: [
                SizedBox(height: AppSpacing.xxl(context)),

                // Success animation
                Builder(
                  builder: (context) {
                    final boxSize = AppSpacing.statsCardHeight(context) * 0.67;
                    return Container(
                      width: boxSize, height: boxSize,
                      decoration: BoxDecoration(
                        color: AppColors.statusResolved.withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                        boxShadow: [BoxShadow(color: AppColors.statusResolved.withValues(alpha: 0.2), blurRadius: 30, spreadRadius: 5)],
                      ),
                      child: Icon(Icons.check_rounded, color: AppColors.statusResolved, size: boxSize * 0.56),
                    );
                  },
                ).animate().scale(begin: const Offset(0.3, 0.3), end: const Offset(1, 1), duration: 600.ms, curve: Curves.elasticOut),

                const SizedBox(height: 24),

                Text('Ticket Generated!', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800, color: AppColors.textPrimary))
                    .animate(delay: 300.ms).fadeIn(duration: 400.ms),

                const SizedBox(height: 8),

                Text('Your complaint has been registered', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary))
                    .animate(delay: 400.ms).fadeIn(duration: 400.ms),

                SizedBox(height: AppSpacing.lg(context)),

                // Ticket details card
                Container(
                  width: double.infinity, padding: AppSpacing.cardPadding(context),
                  decoration: BoxDecoration(
                    color: AppColors.bgCard, borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 4, offset: const Offset(0, 2)),
                    ],
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    // Ticket ID
                    Center(
                      child: Container(
                        padding: EdgeInsets.symmetric(horizontal: AppSpacing.lg(context), vertical: AppSpacing.sm(context)),
                        decoration: BoxDecoration(gradient: AppColors.primaryGradient, borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context))),
                        child: Text(ticket.ticketNumber ?? ticket.id, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: AppSpacing.fontSectionHeader(context), letterSpacing: 1)),
                      ),
                    ),
                    SizedBox(height: AppSpacing.lg(context)),

                    _infoRow(context, 'Date & Time', DateFormat('dd MMM yyyy, hh:mm a').format(ticket.createdAt), Icons.calendar_today_rounded),
                    _divider(),
                    _infoRow(context, 'Location', ticket.location, Icons.location_on_rounded),
                    _divider(),
                    _infoRow(context, 'Category', ticket.category, Icons.category_rounded),
                    _divider(),
                    _infoRow(context, 'Status', ticket.statusLabel, Icons.info_rounded),
                    _divider(),
                    _infoRow(context, 'Assigned To', '${ticket.assignedTo}\n(${ticket.assignedRole})', Icons.person_rounded),
                  ]),
                ).animate(delay: 500.ms).fadeIn(duration: 500.ms).slideY(begin: 0.2, end: 0),

                SizedBox(height: AppSpacing.lg(context)),

                // Info card
                Container(
                  width: double.infinity, padding: EdgeInsets.all(AppSpacing.md(context)),
                  decoration: BoxDecoration(color: AppColors.secondary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)), border: Border.all(color: AppColors.secondary.withValues(alpha: 0.2))),
                  child: Row(children: [
                    Icon(Icons.info_rounded, color: AppColors.secondary, size: AppSpacing.iconSm(context)),
                    SizedBox(width: AppSpacing.sm(context)),
                    Expanded(child: Text('You will receive notifications about the progress of your complaint.', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.secondary))),
                  ]),
                ).animate(delay: 700.ms).fadeIn(duration: 400.ms),

                SizedBox(height: AppSpacing.xl(context)),

                // Buttons
                SizedBox(
                  width: double.infinity, height: AppSpacing.buttonHeight(context),
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)))),
                    child: Text('Back to Home', style: TextStyle(fontSize: AppSpacing.fontSectionHeader(context), fontWeight: FontWeight.w700, color: Colors.white)),
                  ),
                ).animate(delay: 800.ms).fadeIn(duration: 400.ms),
              ],
            ),
          ),
        ),
    );
  }

  Widget _infoRow(BuildContext context, String label, String value, IconData icon) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: AppSpacing.sm(context)),
      child: Row(children: [
        Icon(icon, color: AppColors.primary, size: AppSpacing.iconSm(context)),
        SizedBox(width: AppSpacing.sm(context)),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary, fontSize: AppSpacing.fontCardTitle(context) - 2)),
            SizedBox(height: AppSpacing.xs(context) / 2),
            Text(value, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
          ]),
        ),
      ]),
    );
  }

  Widget _divider() => const Divider(color: AppColors.border, height: 1);
}
