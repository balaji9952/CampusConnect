import 'package:flutter/material.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Responsive — single source of truth for breakpoints & layout helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Central breakpoint & layout utility for Campus Connect.
///
/// Breakpoints (based on shortest dimension / logical width):
///   compact   < 360 dp  — extra-small / budget phones
///   small     360–389   — common small phones
///   normal    390–429   — standard modern phones  (e.g. Pixel 6a, iPhone 14)
///   large     430–599   — large phones (e.g. Pixel 7 Pro, iPhone 14 Pro Max)
///   tablet    ≥ 600 dp  — tablets, foldables (unfolded)
///
/// Usage:
///   AppSpacing.horizontalPad(context)
///   AppSpacing.cardPadding(context)
///   AppSpacing.isTablet(context)
///   AppSpacing.constrained(context: context, child: ...)
class AppSpacing {
  AppSpacing._();

  // ── Raw breakpoint getters ────────────────────────────────────────────────
  static double _w(BuildContext context) => MediaQuery.sizeOf(context).width;

  static bool isCompact(BuildContext context) => _w(context) < 360;
  static bool isSmall(BuildContext context) =>
      _w(context) >= 360 && _w(context) < 390;
  static bool isNormal(BuildContext context) =>
      _w(context) >= 390 && _w(context) < 430;
  static bool isLarge(BuildContext context) =>
      _w(context) >= 430 && _w(context) < 600;
  static bool isTablet(BuildContext context) => _w(context) >= 600;
  static bool isLandscape(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    return size.width > size.height;
  }

  // ── Convenience booleans used by legacy code ──────────────────────────────
  /// True for compact + small (phones narrower than 390 dp).
  static bool isMedium(BuildContext context) => _w(context) < 600;

  // ─────────────────────────────────────────────────────────────────────────
  // Screen-level horizontal padding
  // ─────────────────────────────────────────────────────────────────────────

  /// The primary horizontal padding for page-level scrollable content.
  static double horizontalPad(BuildContext context) {
    final w = _w(context);
    if (w < 360) return 16.0;
    if (w < 390) return 18.0;
    if (w < 430) return 20.0;
    if (w < 600) return 24.0;
    // Tablet: cap and center
    return (w * 0.08).clamp(32.0, 80.0);
  }

  /// Full symmetric screen-level padding (horizontal + vertical).
  static EdgeInsets screenPadding(BuildContext context) {
    final h = horizontalPad(context);
    return EdgeInsets.symmetric(horizontal: h, vertical: 20);
  }

  /// Horizontal-only component of screen padding.
  static EdgeInsets screenH(BuildContext context) =>
      EdgeInsets.symmetric(horizontal: horizontalPad(context));

  // ─────────────────────────────────────────────────────────────────────────
  // Gradient header padding  (e.g. dashboard top banner)
  // ─────────────────────────────────────────────────────────────────────────
  static EdgeInsets headerPadding(BuildContext context) {
    final h = horizontalPad(context);
    final v = isCompact(context) ? 20.0 : 24.0;
    return EdgeInsets.only(left: h, right: h, top: v, bottom: v + 8);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Card / container inner padding
  // ─────────────────────────────────────────────────────────────────────────
  static EdgeInsets cardPadding(BuildContext context) {
    final w = _w(context);
    final p = w < 360 ? 14.0 : w < 390 ? 16.0 : w < 430 ? 18.0 : 20.0;
    return EdgeInsets.all(p);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Section / list item padding
  // ─────────────────────────────────────────────────────────────────────────

  /// Padding used on section headers inside a scrollable page.
  static EdgeInsets sectionPadding(BuildContext context) {
    final h = horizontalPad(context);
    return EdgeInsets.symmetric(horizontal: h, vertical: 16);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Vertical spacing tokens (return double — use inside SizedBox)
  // ─────────────────────────────────────────────────────────────────────────
  static double xs(BuildContext context) => isCompact(context) ? 4.0 : 6.0;
  static double sm(BuildContext context) => isCompact(context) ? 8.0 : 10.0;
  static double md(BuildContext context) => isCompact(context) ? 12.0 : 16.0;
  static double lg(BuildContext context) => isCompact(context) ? 18.0 : 24.0;
  static double xl(BuildContext context) => isCompact(context) ? 24.0 : 32.0;
  static double xxl(BuildContext context) => isCompact(context) ? 32.0 : 48.0;

  // ─────────────────────────────────────────────────────────────────────────
  // Convenience SizedBox widgets
  // ─────────────────────────────────────────────────────────────────────────
  static Widget vXS(BuildContext context) => SizedBox(height: xs(context));
  static Widget vSM(BuildContext context) => SizedBox(height: sm(context));
  static Widget vMD(BuildContext context) => SizedBox(height: md(context));
  static Widget vLG(BuildContext context) => SizedBox(height: lg(context));
  static Widget vXL(BuildContext context) => SizedBox(height: xl(context));
  static Widget vXXL(BuildContext context) => SizedBox(height: xxl(context));

  // ─────────────────────────────────────────────────────────────────────────
  // Button height
  // ─────────────────────────────────────────────────────────────────────────
  static double buttonHeight(BuildContext context) =>
      isCompact(context) ? 48.0 : 52.0;

  // ─────────────────────────────────────────────────────────────────────────
  // Icon sizes
  // ─────────────────────────────────────────────────────────────────────────
  static double iconXS(BuildContext context) => isCompact(context) ? 14.0 : 16.0;
  static double iconSm(BuildContext context) => isCompact(context) ? 18.0 : 20.0;
  static double iconMd(BuildContext context) => isCompact(context) ? 22.0 : 24.0;
  static double iconLg(BuildContext context) => isCompact(context) ? 28.0 : 32.0;
  static double iconXL(BuildContext context) => isCompact(context) ? 44.0 : 52.0;

  // ─────────────────────────────────────────────────────────────────────────
  // Avatar / logo sizes
  // ─────────────────────────────────────────────────────────────────────────

  /// Small avatar (e.g. profile trigger in app bar)
  static double avatarSm(BuildContext context) =>
      isCompact(context) ? 34.0 : 40.0;

  /// Medium avatar (e.g. login screen logo circle)
  static double avatarMd(BuildContext context) =>
      isCompact(context) ? 64.0 : 76.0;

  /// Large avatar (e.g. profile edit page hero)
  static double avatarLg(BuildContext context) =>
      isCompact(context) ? 88.0 : 110.0;

  /// Profile page circle radius
  static double profileRadius(BuildContext context) =>
      isCompact(context) ? 38.0 : 48.0;

  /// Splash screen icon box side length
  static double splashLogo(BuildContext context) =>
      isCompact(context) ? 84.0 : 110.0;

  // ─────────────────────────────────────────────────────────────────────────
  // Card heights
  // ─────────────────────────────────────────────────────────────────────────

  /// Stats card height (student dashboard)
  static double statsCardHeight(BuildContext context) =>
      isCompact(context) ? 110.0 : 140.0;

  // ─────────────────────────────────────────────────────────────────────────
  // Border radius helpers
  // ─────────────────────────────────────────────────────────────────────────
  static double radiusSm(BuildContext context) => isCompact(context) ? 8.0 : 10.0;
  static double radiusMd(BuildContext context) => isCompact(context) ? 12.0 : 14.0;
  static double radiusLg(BuildContext context) => isCompact(context) ? 16.0 : 20.0;
  static double radiusXL(BuildContext context) => isCompact(context) ? 20.0 : 24.0;

  // ─────────────────────────────────────────────────────────────────────────
  // Typography scale  (use only when Theme.textTheme cannot satisfy the need)
  // ─────────────────────────────────────────────────────────────────────────

  /// Display / hero number (e.g. "52" total tickets)
  static double fontDisplay(BuildContext context) {
    final w = _w(context);
    if (w < 360) return 36.0;
    if (w < 390) return 42.0;
    if (w < 430) return 46.0;
    return 52.0;
  }

  /// Section header inside cards
  static double fontSectionHeader(BuildContext context) =>
      isCompact(context) ? 14.0 : 16.0;

  /// Card title / stat label
  static double fontCardTitle(BuildContext context) =>
      isCompact(context) ? 11.0 : 12.0;

  /// Small stat count (mini stat card)
  static double fontStatCount(BuildContext context) {
    final w = _w(context);
    if (w < 360) return 18.0;
    if (w < 390) return 20.0;
    return 22.0;
  }

  /// Badge / chip label
  static double fontBadge(BuildContext context) =>
      isCompact(context) ? 9.0 : 10.0;

  /// Bottom nav label
  static double fontNavLabel(BuildContext context) =>
      isCompact(context) ? 9.0 : 11.0;

  // ─────────────────────────────────────────────────────────────────────────
  // Tablet content-width constraint
  // ─────────────────────────────────────────────────────────────────────────

  /// Wraps content in Center + ConstrainedBox on tablets only.
  static Widget constrained({
    required BuildContext context,
    required Widget child,
    double maxWidth = 600,
  }) {
    if (!isTablet(context)) return child;
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Responsive Widget Helper
// ─────────────────────────────────────────────────────────────────────────────
class Responsive extends StatelessWidget {
  final Widget mobile;
  final Widget? tablet;
  final Widget? desktop;

  const Responsive({
    super.key,
    required this.mobile,
    this.tablet,
    this.desktop,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 1024 && desktop != null) {
          return desktop!;
        } else if (constraints.maxWidth >= 600 && tablet != null) {
          return tablet!;
        } else {
          return mobile;
        }
      },
    );
  }
}
