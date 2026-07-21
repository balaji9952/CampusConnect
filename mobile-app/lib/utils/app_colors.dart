import 'package:flutter/material.dart';

class AppColors {
  // ── Primary — Royal Blue ─────────────────────────────────────────────
  static const primary = Color(0xFF1565C0);       // deep royal blue
  static const primaryLight = Color(0xFF1E88E5);  // medium blue
  static const primaryDark = Color(0xFF0D47A1);   // dark navy blue

  // ── Secondary — Bright Blue ──────────────────────────────────────────
  static const secondary = Color(0xFF2196F3);     // material blue
  static const secondaryLight = Color(0xFF64B5F6);// light sky blue

  // ── Accent — Bold Red ────────────────────────────────────────────────
  static const accent = Color(0xFFD32F2F);        // deep red
  static const accentLight = Color(0xFFEF5350);   // lighter red

  // ── Backgrounds — Light Theme ──────────────────────────────────────────
  static const bgLight = Color(0xFFF8FAFC);        // light gray background
  static const bgCard = Color(0xFFFFFFFF);         // white card
  static const bgCardLight = Color(0xFFF1F5F9);    // slightly tinted card
  static const bgInput = Color(0xFFFFFFFF);        // white input bg

  // ── Text colors ────────────────────────────────────
  static const textPrimary = Color(0xFF0F172A);    // almost black
  static const textSecondary = Color(0xFF475569);  // gray
  static const textHint = Color(0xFF94A3B8);       // light gray
  static const textInverse = Color(0xFFFFFFFF);    // white for buttons

  // ── Borders ────────────────────────────────────────
  static const border = Color(0xFFE2E8F0);
  
  // ── Status colors ─────────────────────────────────────────────────────
  static const statusOpen = Color(0xFF3B82F6);    // blue — open
  static const statusInProgress = Color(0xFFF59E0B); // amber
  static const statusEscalatedL2 = Color(0xFFF97316); // orange-red
  static const statusEscalatedL3 = Color(0xFFEF4444); // red
  static const statusResolved = Color(0xFF10B981); // green
  static const statusClosed = Color(0xFF64748B);  // grey-blue

  // ── Priority colors ───────────────────────────────────────────────────
  static const priorityLow = Color(0xFF10B981);
  static const priorityMedium = Color(0xFFF59E0B);
  static const priorityHigh = Color(0xFFF97316);
  static const priorityCritical = Color(0xFFEF4444);

  // ── Gradients ─────────────────────────────────────────────────────────

  // Subdued primary gradient for standard UI headers
  static const primaryGradient = LinearGradient(
    colors: [Color(0xFF1E40AF), Color(0xFF2563EB)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const bgGradient = LinearGradient(
    colors: [Color(0xFFF8FAFC), Color(0xFFF1F5F9)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  // ── Status helper ─────────────────────────────────────────────────────
  static Color getStatusColor(String status) {
    switch (status) {
      case 'Open':        return statusOpen;
      case 'In Progress': return statusInProgress;
      case 'Escalated L2':return statusEscalatedL2;
      case 'Escalated L3':return statusEscalatedL3;
      case 'Resolved':    return statusResolved;
      case 'Closed':      return statusClosed;
      default:            return statusOpen;
    }
  }

  static Color getPriorityColor(String priority) {
    switch (priority) {
      case 'Low':      return priorityLow;
      case 'Medium':   return priorityMedium;
      case 'High':     return priorityHigh;
      case 'Critical': return priorityCritical;
      default:         return priorityMedium;
    }
  }
}
