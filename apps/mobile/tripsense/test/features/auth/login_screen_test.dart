import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trip/app/app_theme.dart';
import 'package:trip/core/errors/app_failure.dart';
import 'package:trip/features/auth/data/auth_repository_impl.dart';
import 'package:trip/features/auth/presentation/login_screen.dart';
import 'package:trip/l10n/gen/app_localizations.dart';

import '../../support/fake_auth_repository.dart';
import '../../support/test_app.dart';

Widget _app(FakeAuthRepository repo) => ProviderScope(
  overrides: [authRepositoryProvider.overrideWithValue(repo)],
  child: MaterialApp(
    theme: buildTripSenseTheme(),
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
    ],
    supportedLocales: const [Locale('en')],
    locale: const Locale('en'),
    home: const LoginScreen(),
  ),
);

void main() {
  useTallScreen();

  testWidgets('validates empty and malformed input before submitting', (
    tester,
  ) async {
    await tester.pumpWidget(_app(FakeAuthRepository()));

    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pump();
    expect(find.text('This field is required'), findsNWidgets(2));

    await tester.enterText(find.byType(TextFormField).first, 'not-an-email');
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pump();
    expect(find.text('Enter a valid email address'), findsOneWidget);
  });

  testWidgets('shows a friendly message for wrong credentials', (tester) async {
    final repo = FakeAuthRepository()
      ..loginError = const AppFailure(type: AppFailureType.unauthorized);
    await tester.pumpWidget(_app(repo));

    await tester.enterText(find.byType(TextFormField).first, 'a@b.com');
    await tester.enterText(find.byType(TextFormField).last, 'wrongpw');
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Incorrect email or password.'), findsOneWidget);
  });
}
