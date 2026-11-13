import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:trip/app/app_router.dart';
import 'package:trip/app/routes.dart';
import 'package:trip/features/auth/data/auth_repository_impl.dart';
import 'package:trip/l10n/gen/app_localizations.dart';

import '../support/fake_auth_repository.dart';

/// Boots the real router (guard + shell + tabs) with a fake backend.
Future<(FakeAuthRepository, GoRouter)> _pumpApp(
  WidgetTester tester, {
  FakeAuthRepository? repo,
}) async {
  final fake = repo ?? FakeAuthRepository(restored: travelerUser);
  final container = ProviderContainer(
    overrides: [authRepositoryProvider.overrideWithValue(fake)],
  );
  addTearDown(container.dispose);
  final router = container.read(appRouterProvider);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        routerConfig: router,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en')],
        locale: const Locale('en'),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (fake, router);
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('guests land on the login screen', (tester) async {
    final (_, router) = await _pumpApp(tester, repo: FakeAuthRepository());

    expect(router.state.uri.path, Routes.login);
    expect(find.text('Sign in'), findsWidgets);
  });

  testWidgets('a restored traveler lands on Explore with 5 bottom tabs', (
    tester,
  ) async {
    final (_, router) = await _pumpApp(tester);

    expect(router.state.uri.path, Routes.explore);
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(NavigationDestination), findsNWidgets(5));
    for (final label in ['Explore', 'Trips', 'AI Planner', 'Community', 'Profile']) {
      expect(find.text(label), findsWidgets, reason: label);
    }
  });

  testWidgets('tabs switch and unfinished ones show "Coming soon"', (
    tester,
  ) async {
    final (_, router) = await _pumpApp(tester);

    await tester.tap(find.text('Trips'));
    await tester.pumpAndSettle();

    expect(router.state.uri.path, Routes.trips);
    expect(find.text('Coming soon'), findsOneWidget);
  });

  testWidgets('profile shows the user and logs out back to login', (
    tester,
  ) async {
    final (repo, router) = await _pumpApp(tester);

    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();

    expect(find.text('Alex Traveler'), findsOneWidget);
    expect(find.text('a@b.com'), findsOneWidget);

    await tester.tap(find.text('Log out'));
    await tester.pumpAndSettle();

    expect(repo.logoutCalls, 1);
    expect(router.state.uri.path, Routes.login);
  });
}
