import 'package:flutter/material.dart';

/// Bundled Inter (assets/fonts, SIL OFL), same family as the web.
const appFontFamily = 'Inter';

/// Product type roles from `globals.css` (display, page-title, ... overline).
/// Web uses fractional weights (450/550/650); mapped to the nearest static weight.
TextTheme buildAppTextTheme(Color color) {
  TextStyle role(
    double size,
    double lineHeightPx,
    FontWeight weight, {
    double letterSpacingEm = 0,
  }) => TextStyle(
    fontFamily: appFontFamily,
    fontSize: size,
    height: lineHeightPx / size,
    fontWeight: weight,
    letterSpacing: size * letterSpacingEm,
    color: color,
  );

  return TextTheme(
    displayLarge: role(36, 44, FontWeight.w700, letterSpacingEm: -0.025),
    displayMedium: role(30, 36, FontWeight.w700, letterSpacingEm: -0.02),
    displaySmall: role(22, 28, FontWeight.w700, letterSpacingEm: -0.015),
    headlineMedium: role(30, 36, FontWeight.w700, letterSpacingEm: -0.02),
    headlineSmall: role(22, 28, FontWeight.w700, letterSpacingEm: -0.015),
    titleLarge: role(18, 24, FontWeight.w600, letterSpacingEm: -0.01),
    titleMedium: role(15, 24, FontWeight.w600),
    titleSmall: role(14, 20, FontWeight.w500),
    bodyLarge: role(17, 26, FontWeight.w400),
    bodyMedium: role(15, 24, FontWeight.w400),
    bodySmall: role(13, 18, FontWeight.w400),
    labelLarge: role(14, 20, FontWeight.w500),
    labelMedium: role(13, 18, FontWeight.w500),
    labelSmall: role(12, 16, FontWeight.w600, letterSpacingEm: 0.06),
  );
}
