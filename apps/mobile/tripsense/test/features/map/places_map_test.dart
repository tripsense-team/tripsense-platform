import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:trip/app/app_theme.dart';
import 'package:trip/app/routes.dart';
import 'package:trip/core/config/app_config.dart';
import 'package:trip/features/collections/data/collections_repository_impl.dart';
import 'package:trip/features/collections/presentation/collections_controller.dart';
import 'package:trip/features/places/data/places_repository_impl.dart';
import 'package:trip/features/places/domain/place.dart';
import 'package:trip/features/places/presentation/explore_screen.dart';
import 'package:trip/features/places/presentation/place_detail_screen.dart';
import 'package:trip/l10n/gen/app_localizations.dart';

import '../../support/fake_collections_repository.dart';
import '../../support/fake_map.dart';
import '../../support/fake_places_repository.dart';
import '../../support/test_app.dart';

const _here = GeoPoint(16.05, 108.2);

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
        fakeMapOverride(),
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

  group('AppConfig map style', () {
    test('uses the MapVina vector style when a key is set', () {
      const config = AppConfig(mapvinaApiKey: 'k e/y');
      expect(
        config.mapStyleUrl,
        'https://maps.mapvina.com/styles/v2/streets.json?key=k+e%2Fy',
      );
    });

    test('has no style url without a key (map falls back to raster)', () {
      expect(const AppConfig(mapvinaApiKey: '').mapStyleUrl, isNull);
    });
  });

  group('Explore map mode', () {
    final repo = FakePlacesRepository();

    setUp(() {
      repo
        ..feedError = null
        ..feedResult = [
          samplePlace('a', name: 'Cafe A', location: _here),
          samplePlace(
            'b',
            name: 'Cafe B',
            location: const GeoPoint(16.1, 108.3),
          ),
          samplePlace('c', name: 'No Location'),
        ];
    });

    testWidgets('toggles between list and map with pins for located places', (
      tester,
    ) async {
      await _pump(tester, repo);
      expect(find.byKey(const Key('fake-map')), findsNothing);

      await tester.tap(find.byKey(const Key('map-toggle')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('fake-map')), findsOneWidget);
      expect(find.textContaining('pins:2'), findsOneWidget);
      expect(find.byKey(const Key('pin-c')), findsNothing);
      expect(find.text('List'), findsOneWidget);

      await tester.tap(find.byKey(const Key('map-toggle')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('fake-map')), findsNothing);
      expect(find.text('Map'), findsOneWidget);
    });

    testWidgets('tapping a pin shows a card that opens the place', (
      tester,
    ) async {
      final router = await _pump(tester, repo);
      await tester.tap(find.byKey(const Key('map-toggle')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('map-selected-card')), findsNothing);

      await tester.tap(find.byKey(const Key('pin-a')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('map-selected-card')), findsOneWidget);
      expect(find.text('pin a *'), findsOneWidget, reason: 'pin is selected');

      await tester.tap(find.byKey(const Key('map-selected-card')));
      await tester.pumpAndSettle();
      expect(router.state.uri.path, Routes.place('a'));
    });

    testWidgets('map mode shows the error state with retry', (tester) async {
      final failing = FakePlacesRepository()
        ..feedError = serverFailure
        ..searchError = serverFailure;
      await _pump(tester, failing);
      await tester.tap(find.byKey(const Key('map-toggle')));
      await tester.pumpAndSettle();
      expect(find.text('Try again'), findsOneWidget);
      expect(find.byKey(const Key('fake-map')), findsNothing);
    });
  });

  group('Place detail map', () {
    testWidgets('shows a non-interactive map when the place has a location', (
      tester,
    ) async {
      final repo = FakePlacesRepository()
        ..feedResult = [samplePlace('a', name: 'Cafe A', location: _here)];
      await _pump(tester, repo);
      await tester.tap(find.text('Cafe A').last);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('place-map')), findsOneWidget);
      expect(find.text('Location'), findsOneWidget);
      expect(find.textContaining('pins:1 interactive:false'), findsOneWidget);
    });

    testWidgets('hides the map section without a location', (tester) async {
      final repo = FakePlacesRepository()
        ..feedResult = [samplePlace('a', name: 'Cafe A')];
      await _pump(tester, repo);
      await tester.tap(find.text('Cafe A').last);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('place-map')), findsNothing);
    });
  });
}
