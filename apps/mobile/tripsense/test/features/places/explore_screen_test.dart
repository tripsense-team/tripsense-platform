import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:trip/app/app_theme.dart';
import 'package:trip/app/routes.dart';
import 'package:trip/features/collections/data/collections_repository_impl.dart';
import 'package:trip/features/collections/presentation/collections_controller.dart';
import 'package:trip/features/places/data/places_repository_impl.dart';
import 'package:trip/features/places/domain/place.dart';
import 'package:trip/features/places/presentation/explore_screen.dart';
import 'package:trip/features/places/presentation/place_detail_screen.dart';
import 'package:trip/l10n/gen/app_localizations.dart';

import '../../support/fake_collections_repository.dart';
import '../../support/fake_places_repository.dart';
import '../../support/test_app.dart';

Future<GoRouter> _pump(WidgetTester tester, FakePlacesRepository repo) async {
  final router = GoRouter(
    routes: [
      GoRoute(
        path: '/',
        builder: (_, _) => const Scaffold(body: ExploreScreen()),
      ),
      GoRoute(
        path: Routes.placePattern,
        builder: (_, state) => PlaceDetailScreen(place: state.extra! as Place),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        placesRepositoryProvider.overrideWithValue(repo),
        collectionsRepositoryProvider.overrideWithValue(
          FakeCollectionsRepository(),
        ),
        signedInUserIdProvider.overrideWithValue('u1'),
      ],
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
  return router;
}

void main() {
  useTallScreen();

  testWidgets('shows the personalized feed as place cards', (tester) async {
    final repo = FakePlacesRepository()
      ..feedResult = [samplePlace('a', name: 'Cafe A')];
    await _pump(tester, repo);

    expect(find.text('Cafe A'), findsWidgets);
    expect(find.text('Đà Nẵng'), findsOneWidget);
    expect(find.text('4.5'), findsOneWidget);
    expect(find.text('For you'), findsOneWidget);
  });

  testWidgets('shows the fallback note when the feed failed', (tester) async {
    final repo = FakePlacesRepository()..feedError = serverFailure;
    await _pump(tester, repo);

    expect(
      find.text('Showing popular places while we personalize your feed.'),
      findsOneWidget,
    );
    expect(find.text('Place s1'), findsWidgets);
  });

  testWidgets('shows an empty state', (tester) async {
    final repo = FakePlacesRepository()
      ..feedResult = []
      ..searchResult = [];
    await _pump(tester, repo);

    expect(find.textContaining('No places found'), findsOneWidget);
  });

  testWidgets('shows an error with retry that reloads', (tester) async {
    final repo = FakePlacesRepository()
      ..feedError = serverFailure
      ..searchError = serverFailure;
    await _pump(tester, repo);
    expect(find.text('Try again'), findsOneWidget);

    repo
      ..searchError = null
      ..searchResult = [samplePlace('ok', name: 'Recovered')];
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();

    expect(find.text('Recovered'), findsWidgets);
  });

  testWidgets('a category chip searches that category', (tester) async {
    final repo = FakePlacesRepository();
    await _pump(tester, repo);

    await tester.tap(find.byKey(const Key('tab-cafes')));
    await tester.pumpAndSettle();

    expect(repo.searchCalls.last.category, PlaceCategory.cafe);
  });

  testWidgets('submitting a search shows results and can be cleared', (
    tester,
  ) async {
    final repo = FakePlacesRepository()
      ..searchResult = [samplePlace('b', name: 'Bun Cha')];
    await _pump(tester, repo);

    await tester.enterText(find.byKey(const Key('explore-search')), 'bun cha');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();

    expect(find.text('Bun Cha'), findsWidgets);
    expect(find.text('Results for "bun cha"'), findsOneWidget);

    await tester.tap(find.byKey(const Key('explore-clear')));
    await tester.pumpAndSettle();
    expect(find.text('Results for "bun cha"'), findsNothing);
  });

  testWidgets('the destination pill opens a sheet and switches city', (
    tester,
  ) async {
    final repo = FakePlacesRepository();
    await _pump(tester, repo);

    await tester.tap(find.byKey(const Key('destination-pill')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('destination-hue')));
    await tester.pumpAndSettle();

    expect(find.text('Huế'), findsOneWidget);
    expect(repo.feedCalls.last, 'hue');
  });

  testWidgets('tapping a card opens the place detail', (tester) async {
    final repo = FakePlacesRepository()
      ..feedResult = [
        samplePlace('a', name: 'Cafe A', hours: 'Thứ Hai: 07:00–22:00'),
      ]
      ..detailsResult = const Place(
        id: 'a',
        name: 'Cafe A',
        description: 'Cozy spot',
        phone: '0123',
      );
    final router = await _pump(tester, repo);

    await tester.tap(find.text('Cafe A').last);
    await tester.pumpAndSettle();

    expect(router.state.uri.path, Routes.place('a'));
    expect(find.text('Cozy spot'), findsOneWidget);
    expect(find.text('0123'), findsOneWidget);
    expect(find.text('Opening hours'), findsOneWidget);

    await tester.tap(find.byKey(const Key('place-back')));
    await tester.pumpAndSettle();
    expect(router.state.uri.path, '/');
  });

  testWidgets('place detail still renders when details fail to load', (
    tester,
  ) async {
    final repo = FakePlacesRepository()
      ..feedResult = [samplePlace('a', name: 'Cafe A')]
      ..detailsError = serverFailure;
    await _pump(tester, repo);

    await tester.tap(find.text('Cafe A').last);
    await tester.pumpAndSettle();

    expect(find.text('Cafe A'), findsWidgets);
    expect(find.text('1 Main St'), findsOneWidget);
  });
}
