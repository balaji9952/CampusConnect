import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:campus_connect/screens/common/splash_screen.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/globals.dart';
import 'package:campus_connect/utils/app_spacing.dart';


class QRFeedbackApp extends StatelessWidget {
  final AuthService authService;
  final TicketService ticketService;

  const QRFeedbackApp({super.key, required this.authService, required this.ticketService});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      title: 'Campus Connect',
      debugShowCheckedModeBanner: false,
      builder: (context, child) {
        return Theme(
          data: _buildResponsiveTheme(context),
          child: child!,
        );
      },
      home: SplashScreen(authService: authService, ticketService: ticketService),
    );
  }

  ThemeData _buildResponsiveTheme(BuildContext context) {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: const Color(0xFFF8FAFC),
      colorScheme: const ColorScheme.light(
        primary: Color(0xFF1565C0),
        secondary: Color(0xFF2196F3),
        tertiary: Color(0xFFD32F2F),
        surface: Color(0xFFFFFFFF),
        error: Color(0xFFEF4444),
      ),
      textTheme: GoogleFonts.interTextTheme(
        ThemeData.light().textTheme,
      ),
      cardTheme: CardThemeData(
        color: const Color(0xFFFFFFFF),
        elevation: 2,
        shadowColor: Colors.black12,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
          side: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF1565C0),
          foregroundColor: Colors.white,
          padding: EdgeInsets.symmetric(horizontal: AppSpacing.xl(context), vertical: AppSpacing.md(context)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
          ),
          elevation: 1,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFFFFFFF),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
          borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
          borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
          borderSide: const BorderSide(color: Color(0xFF1565C0), width: 2),
        ),
        contentPadding: EdgeInsets.symmetric(horizontal: AppSpacing.md(context), vertical: AppSpacing.md(context)),
        labelStyle: TextStyle(color: const Color(0xFF64748B), fontSize: AppSpacing.fontCardTitle(context) + 2),
        hintStyle: TextStyle(color: const Color(0xFF94A3B8), fontSize: AppSpacing.fontCardTitle(context) + 2),
      ),
    );
  }
}
