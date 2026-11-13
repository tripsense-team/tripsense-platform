import 'package:flutter/material.dart';

import 'design/app_tokens.dart';
import 'design/app_typography.dart';

/// Material theme built from the web design tokens (neutral, flat, bordered).
ThemeData buildTripSenseTheme({Brightness brightness = Brightness.light}) {
  final c = brightness == Brightness.dark ? AppColors.dark : AppColors.light;
  final textTheme = buildAppTextTheme(c.foreground);

  final scheme = ColorScheme(
    brightness: brightness,
    primary: c.primary,
    onPrimary: c.primaryForeground,
    secondary: c.secondary,
    onSecondary: c.primary,
    error: c.destructive,
    onError: Colors.white,
    surface: c.background,
    onSurface: c.foreground,
    onSurfaceVariant: c.mutedForeground,
    outline: c.ring,
    outlineVariant: c.border,
    surfaceContainerLowest: c.background,
    surfaceContainerLow: c.card,
    surfaceContainer: c.muted,
    surfaceContainerHigh: c.muted,
    surfaceContainerHighest: c.accent,
  );

  final controlShape = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(AppRadius.lg),
  );
  OutlineInputBorder inputBorder(Color color, [double width = 1]) =>
      OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        borderSide: BorderSide(color: color, width: width),
      );

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: c.background,
    textTheme: textTheme,
    extensions: [c],
    splashFactory: InkRipple.splashFactory,
    appBarTheme: AppBarTheme(
      backgroundColor: c.background,
      foregroundColor: c.foreground,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: textTheme.titleLarge,
    ),
    dividerTheme: DividerThemeData(color: c.border, space: 1, thickness: 1),
    cardTheme: CardThemeData(
      color: c.card,
      elevation: 0,
      margin: EdgeInsets.zero,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.xl),
        side: BorderSide(color: c.border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: c.background,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: inputBorder(c.input),
      enabledBorder: inputBorder(c.input),
      focusedBorder: inputBorder(c.ring, 1.5),
      errorBorder: inputBorder(c.destructive),
      focusedErrorBorder: inputBorder(c.destructive, 1.5),
      labelStyle: textTheme.bodyMedium?.copyWith(color: c.mutedForeground),
      hintStyle: textTheme.bodyMedium?.copyWith(color: c.mutedForeground),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: c.primary,
        foregroundColor: c.primaryForeground,
        minimumSize: const Size.fromHeight(48),
        shape: controlShape,
        textStyle: textTheme.labelLarge,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: c.foreground,
        minimumSize: const Size.fromHeight(48),
        shape: controlShape,
        side: BorderSide(color: c.border),
        textStyle: textTheme.labelLarge,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: c.foreground,
        textStyle: textTheme.labelLarge,
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: c.background,
      selectedColor: c.primary,
      labelStyle: textTheme.labelMedium,
      side: BorderSide(color: c.border),
      shape: const StadiumBorder(),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: c.background,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      height: 64,
      indicatorColor: c.secondary,
      labelTextStyle: WidgetStatePropertyAll(textTheme.labelSmall),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: c.primary,
      contentTextStyle: textTheme.bodyMedium?.copyWith(
        color: c.primaryForeground,
      ),
      shape: controlShape,
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: c.background,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
    ),
  );
}
