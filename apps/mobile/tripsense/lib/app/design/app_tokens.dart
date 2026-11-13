import 'package:flutter/material.dart';

/// Design tokens ported 1:1 from the web (`apps/web/tripsense/src/app/globals.css`).
/// Keep both in sync: change a token on web -> change it here.
abstract final class AppRadius {
  static const double sm = 6; // radius - 4px
  static const double md = 8; // radius - 2px
  static const double lg = 10; // --radius (0.625rem)
  static const double xl = 14; // radius + 4px
  static const double pill = 999;
}

abstract final class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;

  /// Horizontal page gutter.
  static const double page = 16;
}

/// Semantic palette (light/dark) from the web CSS variables.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.background,
    required this.foreground,
    required this.card,
    required this.primary,
    required this.primaryForeground,
    required this.secondary,
    required this.muted,
    required this.mutedForeground,
    required this.accent,
    required this.border,
    required this.input,
    required this.ring,
    required this.destructive,
    required this.emerald,
    required this.emeraldSoft,
    required this.amber,
    required this.amberSoft,
    required this.blue,
    required this.rose,
  });

  final Color background;
  final Color foreground;
  final Color card;
  final Color primary;
  final Color primaryForeground;
  final Color secondary;
  final Color muted;
  final Color mutedForeground;
  final Color accent;
  final Color border;
  final Color input;
  final Color ring;
  final Color destructive;

  /// Brand highlights used across the web (emerald-500/600, amber-500).
  final Color emerald;
  final Color emeraldSoft;
  final Color amber;
  final Color amberSoft;
  final Color blue;
  final Color rose;

  static const light = AppColors(
    background: Color(0xFFFFFFFF),
    foreground: Color(0xFF0A0A0A),
    card: Color(0xFFFFFFFF),
    primary: Color(0xFF171717),
    primaryForeground: Color(0xFFFAFAFA),
    secondary: Color(0xFFF5F5F5),
    muted: Color(0xFFF5F5F5),
    mutedForeground: Color(0xFF737373),
    accent: Color(0xFFF5F5F5),
    border: Color(0xFFE5E5E5),
    input: Color(0xFFE5E5E5),
    ring: Color(0xFFA1A1A1),
    destructive: Color(0xFFE7000B),
    emerald: Color(0xFF10B981), // emerald-500
    emeraldSoft: Color(0xFFECFDF5), // emerald-50
    amber: Color(0xFFF59E0B), // amber-500
    amberSoft: Color(0xFFFFFBEB), // amber-50
    blue: Color(0xFF2563EB), // blue-600
    rose: Color(0xFFF43F5E), // rose-500
  );

  static const dark = AppColors(
    background: Color(0xFF0A0A0A),
    foreground: Color(0xFFFAFAFA),
    card: Color(0xFF171717),
    primary: Color(0xFFE5E5E5),
    primaryForeground: Color(0xFF171717),
    secondary: Color(0xFF262626),
    muted: Color(0xFF262626),
    mutedForeground: Color(0xFFA1A1A1),
    accent: Color(0xFF404040),
    border: Color(0xFF282828),
    input: Color(0xFF343434),
    ring: Color(0xFF737373),
    destructive: Color(0xFFFF6467),
    emerald: Color(0xFF34D399), // emerald-400
    emeraldSoft: Color(0xFF052E22),
    amber: Color(0xFFFBBF24), // amber-400
    amberSoft: Color(0xFF2A1F05),
    blue: Color(0xFF60A5FA),
    rose: Color(0xFFFB7185),
  );

  @override
  AppColors copyWith() => this;

  @override
  AppColors lerp(AppColors? other, double t) => t < 0.5 ? this : (other ?? this);
}

extension AppColorsContext on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColors>()!;
}

/// Shadows: --shadow-card / --shadow-float.
abstract final class AppShadows {
  static const card = [
    BoxShadow(color: Color(0x0D000000), blurRadius: 3, offset: Offset(0, 1)),
  ];
  static const float = [
    BoxShadow(
      color: Color(0x1A000000),
      blurRadius: 24,
      spreadRadius: -6,
      offset: Offset(0, 8),
    ),
    BoxShadow(
      color: Color(0x0A000000),
      blurRadius: 8,
      spreadRadius: -2,
      offset: Offset(0, 2),
    ),
  ];
}
