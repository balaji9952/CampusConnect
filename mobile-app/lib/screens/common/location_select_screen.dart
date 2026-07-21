import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:campus_connect/utils/app_colors.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/screens/common/complaint_form_screen.dart';

@Deprecated(
  'LocationSelectScreen is replaced by QrScannerScreen. '
  'Students must scan a physical campus QR code to submit feedback. '
  'Manual location selection is no longer permitted. '
  'See lib/screens/common/qr_scanner_screen.dart'
)
class LocationSelectScreen extends StatefulWidget {
  final TicketService ticketService;
  final AuthService authService;
  const LocationSelectScreen({super.key, required this.ticketService, required this.authService});

  @override
  State<LocationSelectScreen> createState() => _LocationSelectScreenState();
}

class _LocationSelectScreenState extends State<LocationSelectScreen> {
  String? _selectedLocation;

  final List<Map<String, dynamic>> _locations = [
    {'id': 1, 'name': 'Academic', 'icon': Icons.school_rounded, 'color': const Color(0xFF6C63FF)},
    {'id': 2, 'name': 'Hostel', 'icon': Icons.hotel_rounded, 'color': const Color(0xFFFF6B9D)},
    {'id': 3, 'name': 'Canteen', 'icon': Icons.restaurant_rounded, 'color': const Color(0xFFFFA726)},
    {'id': 4, 'name': 'Toilet', 'icon': Icons.bathroom_rounded, 'color': const Color(0xFF26A69A)},
    {'id': 5, 'name': 'Library', 'icon': Icons.local_library_rounded, 'color': const Color(0xFF42A5F5)},
    {'id': 6, 'name': 'Transport', 'icon': Icons.directions_bus_rounded, 'color': const Color(0xFFAB47BC)},
    {'id': 7, 'name': 'Other', 'icon': Icons.more_horiz_rounded, 'color': const Color(0xFF78909C)},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: Column(
          children: [
              // App bar
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(children: [
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: AppColors.bgCard, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                      child: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 18),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Text('Select Location', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                ]),
              ),

              // Step indicator
              _stepIndicator(context, 2, 'Select Location'),

              const SizedBox(height: 24),

              // Location pin header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: const Color(0xFF66BB6A).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                    child: const Icon(Icons.location_on_rounded, color: Color(0xFF66BB6A), size: 24),
                  ),
                  const SizedBox(width: 14),
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Where is the issue?', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                    Text('Select the area on campus', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary)),
                  ]),
                ]),
              ).animate().fadeIn(duration: 400.ms),

              const SizedBox(height: 20),

              // Location grid
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final isWide = constraints.maxWidth >= 600;
                      final crossAxisCount = isWide ? 4 : 2;
                      final aspectRatio = isWide ? 1.1 : 1.3;
                      return GridView.builder(
                        physics: const BouncingScrollPhysics(),
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: crossAxisCount,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: aspectRatio,
                        ),
                        itemCount: _locations.length,
                        itemBuilder: (context, i) {
                          final loc = _locations[i];
                          final isSelected = _selectedLocation == loc['name'];
                          return GestureDetector(
                            onTap: () => setState(() => _selectedLocation = loc['name']),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.all(18),
                              decoration: BoxDecoration(
                                color: isSelected ? (loc['color'] as Color).withValues(alpha: 0.08) : AppColors.bgCard,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: isSelected ? loc['color'] as Color : AppColors.border, width: isSelected ? 2 : 1),
                                boxShadow: [
                                  BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 4, offset: const Offset(0, 2)),
                                ],
                              ),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(color: (loc['color'] as Color).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                                  child: Icon(loc['icon'] as IconData, color: loc['color'] as Color, size: 26),
                                ),
                                Row(children: [
                                  Expanded(child: Text(loc['name'] as String, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600, color: isSelected ? AppColors.textPrimary : AppColors.textSecondary))),
                                  if (isSelected) const Icon(Icons.check_circle_rounded, color: AppColors.statusResolved, size: 20),
                                ]),
                              ]),
                            ),
                          ).animate(delay: Duration(milliseconds: 100 * i)).fadeIn(duration: 400.ms).slideY(begin: 0.2, end: 0);
                        },
                      );
                    },
                  ),
                ),
              ),

              // Continue button
              Padding(
                padding: EdgeInsets.all(AppSpacing.horizontalPad(context)),
                child: SizedBox(
                  width: double.infinity,
                  height: AppSpacing.buttonHeight(context),
                  child: ElevatedButton(
                    onPressed: _selectedLocation != null
                        ? () {
                            final locId = _locations.firstWhere((l) => l['name'] == _selectedLocation)['id'] as int;
                            Navigator.push(context, MaterialPageRoute(builder: (_) => ComplaintFormScreen(ticketService: widget.ticketService, authService: widget.authService, location: _selectedLocation!, locationId: locId)));
                          }
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _selectedLocation != null ? AppColors.primary : AppColors.bgCard,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: Text('Continue', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _selectedLocation != null ? Colors.white : Colors.white38)),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
  }

  Widget _stepIndicator(BuildContext context, int step, String label) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(color: AppColors.bgCard, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Row(children: [
        Container(
          width: 32, height: 32,
          decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
          child: Center(child: Text('$step', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800))),
        ),
        const SizedBox(width: 12),
        Text(label, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
        const Spacer(),
        Text('Step $step of 4', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textHint)),
      ]),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.2, end: 0);
  }
}
