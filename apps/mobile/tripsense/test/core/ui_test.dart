import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trip/core/errors/app_failure.dart';
import 'package:trip/core/ui/failure_message.dart';
import 'package:trip/core/ui/state_views.dart';
import 'package:trip/l10n/gen/app_localizations.dart';

Widget _host(Widget child) => MaterialApp(
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ],
  supportedLocales: const [Locale('en')],
  locale: const Locale('en'),
  home: Scaffold(body: child),
);

void main() {
  final l10n = lookupAppLocalizations(const Locale('en'));

  group('failureMessage', () {
    test('maps every failure type to a localized message', () {
      for (final type in AppFailureType.values) {
        final message = failureMessage(l10n, AppFailure(type: type));
        expect(message, isNotEmpty, reason: '$type');
      }
    });

    test('lets login override the unauthorized text', () {
      const failure = AppFailure(type: AppFailureType.unauthorized);
      expect(failureMessage(l10n, failure), l10n.errUnauthorized);
      expect(
        failureMessage(l10n, failure, unauthorized: l10n.errBadCredentials),
        l10n.errBadCredentials,
      );
    });

    test('prefers sanitized server text for validation / conflict', () {
      const failure = AppFailure(
        type: AppFailureType.conflict,
        serverMessage: 'Email already registered',
      );
      expect(failureMessage(l10n, failure), 'Email already registered');
    });

    test('appends the incident reference for server errors', () {
      const failure = AppFailure(
        type: AppFailureType.server,
        incidentId: 'ERR-ABCDE',
      );
      final message = failureMessage(l10n, failure);
      expect(message, contains(l10n.errServer));
      expect(message, contains('ERR-ABCDE'));
    });
  });

  group('state views', () {
    testWidgets('LoadingView shows a progress indicator', (tester) async {
      await tester.pumpWidget(_host(const LoadingView()));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('EmptyView shows the default and a custom message', (
      tester,
    ) async {
      await tester.pumpWidget(_host(const EmptyView()));
      expect(find.text('Nothing here yet'), findsOneWidget);

      await tester.pumpWidget(_host(const EmptyView(message: 'No trips')));
      expect(find.text('No trips'), findsOneWidget);
    });

    testWidgets('ErrorView hides raw errors and retries on tap', (
      tester,
    ) async {
      var retried = 0;
      await tester.pumpWidget(
        _host(
          ErrorView(
            error: Exception('JDBC connection failed at SELECT *'),
            onRetry: () => retried++,
          ),
        ),
      );

      expect(find.textContaining('JDBC'), findsNothing);
      expect(find.text(l10n.errUnknown), findsOneWidget);

      await tester.tap(find.text('Try again'));
      expect(retried, 1);
    });

    testWidgets('ErrorView without onRetry has no retry button', (
      tester,
    ) async {
      await tester.pumpWidget(
        _host(const ErrorView(error: AppFailure(type: AppFailureType.network))),
      );
      expect(find.text('Try again'), findsNothing);
      expect(find.text(l10n.errNetwork), findsOneWidget);
    });
  });
}
