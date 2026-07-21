import 'package:flutter/material.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/models/user.dart';
import 'package:campus_connect/screens/common/startup_screen.dart';
import 'package:campus_connect/screens/student/student_dashboard.dart';
import 'package:campus_connect/screens/staff/staff_dashboard.dart';

class RoleRouter extends StatelessWidget {
  final AuthService authService;
  final TicketService ticketService;

  const RoleRouter({super.key, required this.authService, required this.ticketService});

  @override
  Widget build(BuildContext context) {
    if (!authService.isAuthenticated) {
      return StartupScreen(authService: authService, ticketService: ticketService);
    }

    final role = authService.currentUser!.role;
    switch (role) {
      case UserRole.student:
        return StudentDashboard(authService: authService, ticketService: ticketService);
      case UserRole.staff:
        return StaffDashboard(authService: authService, ticketService: ticketService);
      default:
        // Any unrecognised role falls back to the startup screen
        return StartupScreen(authService: authService, ticketService: ticketService);
    }
  }
}
