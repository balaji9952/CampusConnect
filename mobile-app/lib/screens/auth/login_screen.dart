import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:campus_connect/utils/app_colors.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/models/user.dart';
import 'package:campus_connect/routes/role_router.dart';

class LoginScreen extends StatefulWidget {
  final AuthService authService;
  final TicketService ticketService;
  final UserRole? initialRole;

  const LoginScreen({
    super.key,
    required this.authService,
    required this.ticketService,
    this.initialRole,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  late UserRole _selectedRole;

  final _identifierController = TextEditingController();
  final _passwordController   = TextEditingController();
  bool _isLoading       = false;
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    _selectedRole = widget.initialRole ?? UserRole.student;
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  // ── Smart login: auto-detect email vs ID ────────────────────────────────
  Future<void> _handleLogin() async {
    final identifier = _identifierController.text.trim();
    final password   = _passwordController.text.trim();

    if (identifier.isEmpty || password.isEmpty) {
      _showSnack('Please fill in all fields');
      return;
    }

    setState(() => _isLoading = true);

    // With the live backend, we just pass the identifier and password.
    // The backend logic checks whether it's an email or a register number.
    try {
      await widget.authService.login(identifier, password, _selectedRole.index);
      
      if (mounted) {
        setState(() => _isLoading = false);
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(
            builder: (_) => RoleRouter(
              authService: widget.authService,
              ticketService: widget.ticketService,
            ),
          ),
          (route) => false,
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showSnack(e.toString().replaceAll('ApiException: ', ''));
      }
    }
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppColors.accent),
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  String get _identifierHint {
    switch (_selectedRole) {
      case UserRole.staff:
        return 'Email or Staff ID';
      case UserRole.student:
        return 'Email or Register Number';
      default:
        return 'Email Address';
    }
  }

  String _roleBadgeLabel() {
    switch (_selectedRole) {
      case UserRole.student: return 'STUDENT LOGIN';
      case UserRole.staff:   return 'STAFF LOGIN';
      default:               return '${_selectedRole.name.toUpperCase()} LOGIN';
    }
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final hPad = AppSpacing.horizontalPad(context);

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(horizontal: hPad, vertical: 24),
            child: AppSpacing.constrained(
              context: context,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ── Logo ────────────────────────────────────────────────
                  Center(
                    child: Builder(
                      builder: (context) {
                        final logoSize = AppSpacing.avatarMd(context);
                        final iconSize = logoSize * 0.5;
                        return Container(
                          width: logoSize,
                          height: logoSize,
                          decoration: BoxDecoration(
                            gradient: AppColors.primaryGradient,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.primary.withValues(alpha: 0.25),
                                blurRadius: 18,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Icon(Icons.forum_rounded,
                              color: Colors.white, size: iconSize),
                        );
                      },
                    ).animate().scale(duration: 600.ms, curve: Curves.easeOutBack),
                  ),

                  Text(
                    'Campus Connect',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                          fontSize: AppSpacing.isCompact(context) ? 24.0 : null,
                        ),
                  ).animate(delay: 150.ms).fadeIn().slideY(begin: 0.2),

                  SizedBox(height: AppSpacing.xs(context)),

                  Center(
                    child: Container(
                      padding: EdgeInsets.symmetric(
                          horizontal: AppSpacing.md(context), vertical: 5),
                      decoration: BoxDecoration(
                        gradient: AppColors.primaryGradient,
                        borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
                      ),
                      child: Text(
                        _roleBadgeLabel(),
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: AppSpacing.fontCardTitle(context) - 3,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                  ).animate(delay: 250.ms).fadeIn(),

                  SizedBox(height: AppSpacing.xl(context)),

                  // ── Form Card ────────────────────────────────────────────
                  Container(
                    padding: AppSpacing.cardPadding(context),
                    decoration: BoxDecoration(
                      color: AppColors.bgCard,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: AppColors.border),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TextFormField(
                          controller: _identifierController,
                          style: TextStyle(color: AppColors.textPrimary, fontSize: AppSpacing.fontCardTitle(context)),
                          // Let keyboard adapt as user types
                          keyboardType: TextInputType.emailAddress,
                          autocorrect: false,
                          decoration: InputDecoration(
                            labelText: _identifierHint,
                            hintText: _identifierHint,
                            labelStyle: TextStyle(fontSize: AppSpacing.fontCardTitle(context)),
                            hintStyle: TextStyle(fontSize: AppSpacing.fontCardTitle(context)),
                            prefixIcon: Icon(Icons.person_outline_rounded, size: AppSpacing.iconSm(context)),
                            // Small hint chip inside the field
                            suffixIcon: Padding(
                              padding: EdgeInsets.only(right: AppSpacing.sm(context)),
                              child: _SmartInputBadge(
                                controller: _identifierController,
                                role: _selectedRole,
                              ),
                            ),
                            suffixIconConstraints: const BoxConstraints(
                              minWidth: 0,
                              minHeight: 0,
                            ),
                          ),
                        ),

                        SizedBox(height: AppSpacing.md(context)),

                        TextFormField(
                          controller: _passwordController,
                          style: TextStyle(color: AppColors.textPrimary, fontSize: AppSpacing.fontCardTitle(context)),
                          obscureText: _obscurePassword,
                          decoration: InputDecoration(
                            labelText: 'Password',
                            labelStyle: TextStyle(fontSize: AppSpacing.fontCardTitle(context)),
                            prefixIcon:
                                Icon(Icons.lock_outline_rounded, size: AppSpacing.iconSm(context)),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                                size: AppSpacing.iconSm(context),
                              ),
                              onPressed: () => setState(
                                  () => _obscurePassword = !_obscurePassword),
                            ),
                          ),
                        ),

                        SizedBox(height: AppSpacing.xs(context)),

                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: () {},
                            child: Text('Forgot Password?',
                                style:
                                    TextStyle(color: AppColors.primary, fontSize: AppSpacing.fontCardTitle(context))),
                          ),
                        ),

                        SizedBox(height: AppSpacing.md(context)),

                        // ── Login Button ───────────────────────────────────
                        SizedBox(
                          height: AppSpacing.buttonHeight(context),
                          child: ElevatedButton(
                            onPressed: _isLoading ? null : _handleLogin,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context))),
                            ),
                            child: _isLoading
                                ? const SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(
                                        color: Colors.white, strokeWidth: 2),
                                  )
                                : Text(
                                    'LOGIN',
                                    style: TextStyle(
                                      fontSize: AppSpacing.fontCardTitle(context) + 2,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 1.5,
                                      color: Colors.white,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ).animate(delay: 500.ms).fadeIn().slideY(begin: 0.2),

                  const SizedBox(height: 20),

                  // ── Helper text ──────────────────────────────────────────
                  if (_selectedRole == UserRole.staff ||
                      _selectedRole == UserRole.student)
                    Center(
                      child: Text(
                        _selectedRole == UserRole.staff
                            ? 'You can sign in with your email or Staff ID'
                            : 'You can sign in with your email or Register Number',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: AppSpacing.fontCardTitle(context) - 2,
                          color: AppColors.textSecondary
                              .withValues(alpha: 0.7),
                        ),
                      ),
                    ).animate(delay: 700.ms).fadeIn(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Live badge that shows "EMAIL" or "ID" based on current input ────────────

class _SmartInputBadge extends StatefulWidget {
  final TextEditingController controller;
  final UserRole role;

  const _SmartInputBadge({
    required this.controller,
    required this.role,
  });

  @override
  State<_SmartInputBadge> createState() => _SmartInputBadgeState();
}

class _SmartInputBadgeState extends State<_SmartInputBadge> {
  bool _isEmail = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onTextChanged);
  }

  void _onTextChanged() {
    final newIsEmail = widget.controller.text.contains('@');
    if (newIsEmail != _isEmail) {
      setState(() => _isEmail = newIsEmail);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTextChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.controller.text.isEmpty) return const SizedBox.shrink();

    final label = _isEmail
        ? 'EMAIL'
        : (widget.role == UserRole.staff ? 'STAFF ID' : 'REG. NO.');
    final color = _isEmail ? AppColors.primary : const Color(0xFF059669);

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      child: Container(
        key: ValueKey(label),
        padding: EdgeInsets.symmetric(horizontal: AppSpacing.sm(context), vertical: 3),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: AppSpacing.fontCardTitle(context) - 4,
            fontWeight: FontWeight.w800,
            color: color,
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }
}
