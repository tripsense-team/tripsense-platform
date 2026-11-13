import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:trip/app/app_theme.dart';
import 'package:trip/app/design/app_tokens.dart';

/// Guards parity with the web design tokens in
/// `apps/web/tripsense/src/app/globals.css`.
void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  test('light palette matches the web CSS variables', () {
    const c = AppColors.light;
    expect(c.background, const Color(0xFFFFFFFF));
    expect(c.foreground, const Color(0xFF0A0A0A));
    expect(c.primary, const Color(0xFF171717));
    expect(c.border, const Color(0xFFE5E5E5));
    expect(c.mutedForeground, const Color(0xFF737373));
    expect(c.destructive, const Color(0xFFE7000B));
  });

  test('dark palette matches the web .dark variables', () {
    const c = AppColors.dark;
    expect(c.background, const Color(0xFF0A0A0A));
    expect(c.card, const Color(0xFF171717));
    expect(c.primary, const Color(0xFFE5E5E5));
    expect(c.border, const Color(0xFF282828));
  });

  test('radius scale follows --radius = 0.625rem', () {
    expect(AppRadius.lg, 10);
    expect(AppRadius.md, AppRadius.lg - 2);
    expect(AppRadius.sm, AppRadius.lg - 4);
    expect(AppRadius.xl, AppRadius.lg + 4);
  });

  testWidgets('theme exposes tokens through ThemeExtension in both modes', (
    tester,
  ) async {
    for (final brightness in Brightness.values) {
      final theme = buildTripSenseTheme(brightness: brightness);
      final colors = theme.extension<AppColors>()!;
      final expected = brightness == Brightness.dark
          ? AppColors.dark
          : AppColors.light;

      expect(colors.background, expected.background);
      expect(theme.scaffoldBackgroundColor, expected.background);
      expect(theme.colorScheme.primary, expected.primary);
      expect(theme.colorScheme.outlineVariant, expected.border);
    }
    // Inter is fetched lazily by google_fonts; silence the offline test lookup.
    tester.takeException();
  });
}
