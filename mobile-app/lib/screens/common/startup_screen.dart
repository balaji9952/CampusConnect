import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:campus_connect/utils/app_colors.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/services/api_service.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/routes/role_router.dart';

class StartupScreen extends StatelessWidget {
  final AuthService authService;
  final TicketService ticketService;

  const StartupScreen({super.key, required this.authService, required this.ticketService});

  @override
  Widget build(BuildContext context) {
    final hPad = AppSpacing.horizontalPad(context);
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── Background photo ──────────────────────────────────────────
          Image.asset(
            'assets/images/mzcet.jpg',
            fit: BoxFit.cover,
          ),

          // ── Dark gradient overlay for readability ─────────────────────
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xAA000000),
                  Color(0xCC000022),
                ],
              ),
            ),
          ),

          // ── Content ───────────────────────────────────────────────────
          SafeArea(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: hPad, vertical: 24),
              child: AppSpacing.constrained(
                context: context,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Spacer(),

                    // College Logo
                    Center(
                      child: Builder(
                        builder: (context) {
                          final logoSize = AppSpacing.avatarLg(context);
                          return Container(
                            width: logoSize,
                            height: logoSize,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.4),
                                  blurRadius: 32,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            child: ClipOval(
                              child: Image.asset(
                                'assets/images/college_logo.png',
                                width: logoSize,
                                height: logoSize,
                                fit: BoxFit.cover,
                              ),
                            ),
                          );
                        },
                      ).animate().scale(duration: 600.ms, curve: Curves.easeOutBack),
                    ),

                    SizedBox(height: AppSpacing.xl(context)),

                    Text(
                      'Campus Connect',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                    ).animate(delay: 200.ms).fadeIn().slideY(begin: 0.2),

                    const SizedBox(height: 16),

                    // College Details
                    Column(
                      children: [
                        Text(
                          'MOUNT ZION',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: 1.2,
                              ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'COLLEGE OF ENGINEERING & TECHNOLOGY',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: Colors.white70,
                                letterSpacing: 0.6,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '(Autonomous)',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFFFF6B6B),
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Pudukkottai - 622 507, Tamil Nadu',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                fontWeight: FontWeight.w600,
                                color: Colors.white60,
                              ),
                        ),
                      ],
                    ).animate(delay: 300.ms).fadeIn().slideY(begin: 0.2),

                    const Spacer(),

                    // ── SSO: Continue with Google ─────────────────────────
                    _GoogleSSOButton(
                      authService: authService,
                      ticketService: ticketService,
                    ).animate(delay: 400.ms).fadeIn().slideY(begin: 0.2),

                    SizedBox(height: AppSpacing.md(context)),

                    // Hint text
                    Text(
                      'Use your institutional Google account\nto sign in securely',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.white54,
                            height: 1.5,
                          ),
                    ).animate(delay: 550.ms).fadeIn(),

                    SizedBox(height: AppSpacing.md(context)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Google SSO Button ──────────────────────────────────────────────────────────

class _GoogleSSOButton extends StatefulWidget {
  final AuthService authService;
  final TicketService ticketService;

  const _GoogleSSOButton({
    required this.authService,
    required this.ticketService,
  });

  @override
  State<_GoogleSSOButton> createState() => _GoogleSSOButtonState();
}

class _GoogleSSOButtonState extends State<_GoogleSSOButton> {
  bool _isLoading = false;

  // Google Sign-In instance — serverClientId must be the WEB client ID
  static final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
    serverClientId: '609668322154-et2vg0u7maa9g19phba0rom4v3emnq2m.apps.googleusercontent.com',
  );

  Future<void> _handleGoogleSignIn() async {
    setState(() => _isLoading = true);
    try {
      // 1. Launch the Google account picker
      final GoogleSignInAccount? account = await _googleSignIn.signIn();
      if (account == null) {
        // User cancelled — no error needed
        setState(() => _isLoading = false);
        return;
      }

      // 2. Get auth tokens
      final GoogleSignInAuthentication auth = await account.authentication;
      final String? idToken = auth.idToken;

      if (idToken == null) {
        throw ApiException(401, 'Could not get Google token. Try again.');
      }

      // 3. Send to our backend for verification
      await widget.authService.mobileGoogleLogin(idToken);

      // 4. Navigate to dashboard
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          PageRouteBuilder(
            pageBuilder: (_, __, ___) => RoleRouter(
              authService: widget.authService,
              ticketService: widget.ticketService,
            ),
            transitionsBuilder: (_, animation, __, child) =>
                FadeTransition(opacity: animation, child: child),
            transitionDuration: const Duration(milliseconds: 500),
          ),
          (route) => false,
        );
      }
    } on AccountNotRegisteredException catch (e) {
      // College email exists in Google but NOT in our DB
      if (mounted) {
        await showDialog(
          context: context,
          builder: (_) => AlertDialog(
            title: const Row(
              children: [
                Icon(Icons.person_off_outlined, color: Colors.orange),
                SizedBox(width: 8),
                Text('Account Not Found'),
              ],
            ),
            content: Text(
              '${e.email}\n\n${e.message}',
              style: const TextStyle(height: 1.5),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    } on SsoError catch (e) {
      // Typed backend errors (TOKEN_EXPIRED, INVALID_DOMAIN, ACCOUNT_DISABLED…)
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.userMessage),
            backgroundColor: Colors.red.shade700,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('ApiException: 401 - ', '').replaceAll('Exception: ', '')),
            backgroundColor: Colors.red.shade700,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: AppSpacing.buttonHeight(context),
      child: ElevatedButton(
        onPressed: _isLoading ? null : _handleGoogleSignIn,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.white,
          foregroundColor: const Color(0xFF1F1F1F),
          elevation: 4,
          shadowColor: Colors.black38,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          padding: EdgeInsets.symmetric(vertical: AppSpacing.md(context)),
        ),
        child: _isLoading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Color(0xFF1565C0),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Google "G" coloured circle
                  Container(
                    width: 22,
                    height: 22,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: SweepGradient(
                        colors: [
                          Color(0xFF4285F4),
                          Color(0xFF4285F4),
                          Color(0xFFEA4335),
                          Color(0xFFEA4335),
                          Color(0xFFFBBC05),
                          Color(0xFFFBBC05),
                          Color(0xFF34A853),
                          Color(0xFF34A853),
                          Color(0xFF4285F4),
                        ],
                        stops: [0.0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1.0, 1.0],
                      ),
                    ),
                    child: const Center(
                      child: Text(
                        'G',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    'Continue with Google',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                      color: Color(0xFF1F1F1F),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
