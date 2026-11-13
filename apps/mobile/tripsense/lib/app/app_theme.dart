import 'package:flutter/material.dart';

import 'design/app_tokens.dart';
import 'design/app_typography.dart';

/// Control heights used on web (h-12 buttons/inputs, h-14 option rows).
const controlHeight = 48.0;
const inputHeight = 56.0;

/// Material theme built from the web design tokens: neutral palette, flat
/// surfaces, hairline borders and fully rounded (pill) controls.
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

  const pill = StadiumBorder();
  final pillBorder = BorderSide(color: c.border);
  final buttonText = textTheme.labelLarge?.copyWith(
    fontWeight: FontWeight.w600,
    fontSize: 15,
  );

  OutlineInputBorder inputBorder(Color color, [double width = 1]) =>
      OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.pill),
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
        borderRadius: BorderRadius.circular(AppRadius.xxl),
        side: BorderSide(color: c.border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: c.background,
      contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 17),
      border: inputBorder(c.input),
      enabledBorder: inputBorder(c.input),
      focusedBorder: inputBorder(c.foreground, 1.5),
      errorBorder: inputBorder(c.destructive),
      focusedErrorBorder: inputBorder(c.destructive, 1.5),
      labelStyle: textTheme.bodyMedium?.copyWith(color: c.mutedForeground),
      floatingLabelStyle: textTheme.bodySmall?.copyWith(
        color: c.mutedForeground,
      ),
      hintStyle: textTheme.bodyMedium?.copyWith(color: c.mutedForeground),
      prefixIconColor: c.mutedForeground,
      suffixStyle: textTheme.bodyMedium?.copyWith(
        color: c.mutedForeground,
        fontWeight: FontWeight.w600,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: c.primary,
        foregroundColor: c.primaryForeground,
        disabledBackgroundColor: c.primary.withValues(alpha: 0.4),
        disabledForegroundColor: c.primaryForeground.withValues(alpha: 0.9),
        minimumSize: const Size.fromHeight(controlHeight),
        padding: const EdgeInsets.symmetric(horizontal: 32),
        shape: pill,
        elevation: 0,
        textStyle: buttonText,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: c.foreground,
        minimumSize: const Size.fromHeight(controlHeight),
        padding: const EdgeInsets.symmetric(horizontal: 24),
        shape: pill,
        side: pillBorder,
        textStyle: buttonText,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: c.foreground,
        shape: pill,
        textStyle: buttonText,
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: c.background,
      selectedColor: c.primary,
      labelStyle: textTheme.labelMedium,
      side: pillBorder,
      shape: pill,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: c.background,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      height: 64,
      indicatorColor: Colors.transparent,
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 22,
          color: states.contains(WidgetState.selected)
              ? c.primary
              : c.mutedForeground,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => textTheme.labelSmall?.copyWith(
          letterSpacing: 0,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
          color: states.contains(WidgetState.selected)
              ? c.primary
              : c.mutedForeground,
        ),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: c.primary,
      contentTextStyle: textTheme.bodyMedium?.copyWith(
        color: c.primaryForeground,
      ),
      shape: const StadiumBorder(),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: c.background,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppRadius.xxl),
        ),
      ),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: c.card,
      surfaceTintColor: Colors.transparent,
      elevation: 6,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.xl),
        side: BorderSide(color: c.border),
      ),
    ),
  );
}
