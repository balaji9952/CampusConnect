import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:campus_connect/utils/app_colors.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/routes/role_router.dart';
import 'package:campus_connect/services/fcm_service.dart';

class SplashScreen extends StatefulWidget {
  final AuthService authService;
  final TicketService ticketService;

  const SplashScreen({super.key, required this.authService, required this.ticketService});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      final stopwatch = Stopwatch()..start();
      debugPrint('Startup: Auth check started');
      
      // Initialize FCM safely after runApp has been called
      // Execute without awaiting so it doesn't block the UI if the user ignores the permission prompt
      FCMService().initialize().catchError((e) {
        debugPrint('[FCM] Non-blocking init error: $e');
      });

      // Wait for auth check and a minimum splash delay for animations
      await Future.wait([
        widget.authService.isLoggedIn().then((_) {
          debugPrint('[Startup] Auth check: ${stopwatch.elapsedMilliseconds} ms');
        }),
        Future.delayed(const Duration(milliseconds: 3500)),
      ]);

      if (mounted) {
        debugPrint('[Startup] Navigation: ${stopwatch.elapsedMilliseconds} ms');
        Navigator.of(context).pushReplacement(
          PageRouteBuilder(
            pageBuilder: (_, __, ___) => RoleRouter(
                authService: widget.authService,
                ticketService: widget.ticketService),
            transitionsBuilder: (_, animation, __, child) {
              return FadeTransition(opacity: animation, child: child);
            },
            transitionDuration: const Duration(milliseconds: 800),
          ),
        );
      }
    } catch (e, st) {
      debugPrint('CRITICAL STARTUP ERROR in Splash: $e\n$st');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Icon with glow
              Builder(
                builder: (context) {
                  final boxSize = AppSpacing.splashLogo(context);
                  final iconSize = AppSpacing.iconLg(context);
                  return Container(
                    width: boxSize,
                    height: boxSize,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(boxSize * 0.25),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.3),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Icon(
                      Icons.forum_rounded,
                      size: iconSize,
                      color: Colors.white,
                    ),
                  );
                },
              )
                  .animate()
                  .scale(
                    begin: const Offset(0.5, 0.5),
                    end: const Offset(1.0, 1.0),
                    duration: 800.ms,
                    curve: Curves.elasticOut,
                  )
                  .fadeIn(duration: 600.ms),

              const SizedBox(height: 32),

              // App Name
              Padding(
                padding: EdgeInsets.symmetric(horizontal: AppSpacing.horizontalPad(context)),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    'CAMPUS CONNECT',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                          letterSpacing: 4,
                          color: AppColors.textPrimary,
                        ),
                  ),
                ),
              )
                  .animate(delay: 400.ms)
                  .fadeIn(duration: 600.ms)
                  .slideY(begin: 0.3, end: 0),

              const SizedBox(height: 8),

              // Subtitle
              Padding(
                padding: EdgeInsets.symmetric(horizontal: AppSpacing.horizontalPad(context)),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    'FEEDBACK SYSTEM',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          letterSpacing: 6,
                          color: AppColors.primary,
                        ),
                  ),
                ),
              )
                  .animate(delay: 600.ms)
                  .fadeIn(duration: 600.ms)
                  .slideY(begin: 0.3, end: 0),

              const SizedBox(height: 48),

              // Loading indicator
              Builder(
                builder: (context) {
                  final barWidth = MediaQuery.sizeOf(context).width * 0.45;
                  return SizedBox(
                    width: barWidth.clamp(120.0, 220.0),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        backgroundColor: AppColors.border,
                        valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                        minHeight: 4,
                      ),
                    ),
                  );
                },
              )
                  .animate(delay: 1000.ms)
                  .fadeIn(duration: 400.ms),

              const SizedBox(height: 16),

              Text(
                'Initializing...',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textHint,
                      letterSpacing: 2,
                    ),
              )
                  .animate(delay: 1200.ms)
                  .fadeIn(duration: 400.ms),
            ],
          ),
        ),
      ),
    );
  }
}
