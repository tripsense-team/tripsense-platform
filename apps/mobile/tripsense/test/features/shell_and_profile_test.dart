import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:trip/app/app_router.dart';
import 'package:trip/app/app_theme.dart';
import 'package:trip/app/routes.dart';
import 'package:trip/features/auth/data/auth_repository_impl.dart';
import 'package:trip/features/places/data/places_repository_impl.dart';
import 'package:trip/l10n/gen/app_localizations.dart';

import '../support/fake_auth_repository.dart';
import '../support/fake_places_repository.dart';
import '../support/test_app.dart';

/// Boots the real router (guard + shell + tabs) with a fake backend.
Future<(FakeAuthRepository, GoRouter)> _pumpApp(
  WidgetTester tester, {
  FakeAuthRepository? repo,
}) async {
  final fake = repo ?? FakeAuthRepository(restored: travelerUser);
  final container = ProviderContainer(
    overrides: [
      authRepositoryProvider.overrideWithValue(fake),
      placesRepositoryProvider.overrideWithValue(FakePlacesRepository()),
    ],
  );
  addTearDown(container.dispose);
  final router = container.read(appRouterProvider);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        routerConfig: router,
        theme: buildTripSenseTheme(),
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
  useTallScreen();

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
    for (final label in ['Explore', 'Chat', 'Trips', 'Planner', 'Saved']) {
      expect(find.text(label), findsWidgets, reason: label);
    }
  });

  testWidgets('every tab opens its page; unfinished ones say "Coming soon"', (
    tester,
  ) async {
    final (_, router) = await _pumpApp(tester);

    for (final (label, path) in [
      ('Chat', Routes.chat),
      ('Trips', Routes.trips),
      ('Planner', Routes.aiPlanner),
      ('Saved', Routes.saved),
      ('Explore', Routes.explore),
    ]) {
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text(label),
        ),
      );
      await tester.pumpAndSettle();

      expect(router.state.uri.path, path, reason: label);
      expect(
        find.text('Coming soon'),
        path == Routes.explore ? findsNothing : findsOneWidget,
        reason: label,
      );
    }
  });

  testWidgets('the header shows the brand and a user menu', (tester) async {
    await _pumpApp(tester);

    expect(find.text('TripSense'), findsOneWidget);
    expect(find.byKey(const Key('user-menu')), findsOneWidget);
    expect(find.text('A'), findsOneWidget, reason: 'avatar initial');
  });

  testWidgets('the user menu opens profile and community pages', (
    tester,
  ) async {
    final (_, router) = await _pumpApp(tester);

    await tester.tap(find.byKey(const Key('user-menu')));
    await tester.pumpAndSettle();
    expect(find.text('Community'), findsOneWidget);
    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();

    expect(router.state.uri.path, Routes.profile);
    expect(find.text('Alex Traveler'), findsOneWidget);
    expect(find.text('a@b.com'), findsOneWidget);

    router.pop();
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('user-menu')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Community'));
    await tester.pumpAndSettle();

    expect(router.state.uri.path, Routes.community);
    expect(find.text('Coming soon'), findsOneWidget);
  });

  testWidgets('logging out from the user menu returns to login', (
    tester,
  ) async {
    final (repo, router) = await _pumpApp(tester);

    await tester.tap(find.byKey(const Key('user-menu')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Log out'));
    await tester.pumpAndSettle();

    expect(repo.logoutCalls, 1);
    expect(router.state.uri.path, Routes.login);
  });
}
