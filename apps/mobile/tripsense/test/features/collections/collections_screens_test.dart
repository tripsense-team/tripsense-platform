import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:trip/app/app_theme.dart';
import 'package:trip/app/routes.dart';
import 'package:trip/features/collections/data/collections_repository_impl.dart';
import 'package:trip/features/collections/domain/collections.dart';
import 'package:trip/features/collections/presentation/collections_controller.dart';
import 'package:trip/features/collections/presentation/collections_screen.dart';
import 'package:trip/features/collections/presentation/saved_screen.dart';
import 'package:trip/features/collections/presentation/widgets/save_button.dart';
import 'package:trip/features/places/data/places_repository_impl.dart';
import 'package:trip/l10n/gen/app_localizations.dart';

import '../../support/fake_collections_repository.dart';
import '../../support/fake_places_repository.dart';
import '../../support/test_app.dart';

Future<GoRouter> _pump(
  WidgetTester tester,
  FakeCollectionsRepository repo, {
  required String initial,
  Widget? home,
}) async {
  final router = GoRouter(
    initialLocation: initial,
    routes: [
      GoRoute(path: '/', builder: (_, _) => home ?? const SizedBox()),
      GoRoute(
        path: Routes.saved,
        builder: (_, _) => const Scaffold(body: SavedScreen()),
      ),
      GoRoute(
        path: Routes.collections,
        builder: (_, _) => const CollectionsScreen(),
      ),
      GoRoute(
        path: Routes.collectionDetailPattern,
        builder: (_, state) =>
            CollectionDetailScreen(collection: state.extra! as PlaceCollection),
      ),
      GoRoute(
        path: Routes.placePattern,
        builder: (_, state) => const Scaffold(body: Text('PLACE DETAIL')),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        collectionsRepositoryProvider.overrideWithValue(repo),
        placesRepositoryProvider.overrideWithValue(FakePlacesRepository()),
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

  group('Saved tab', () {
    testWidgets('lists saved places with collection filter chips', (
      tester,
    ) async {
      final repo = FakeCollectionsRepository()
        ..savedPages = [
          [savedItem('a'), savedItem('b')],
        ];
      await _pump(tester, repo, initial: Routes.saved);

      expect(find.text('Saved places'), findsOneWidget);
      expect(find.text('Saved a'), findsWidgets);
      expect(find.text('Saved b'), findsWidgets);
      expect(find.byKey(const Key('saved-chip-all')), findsOneWidget);
      expect(find.text('Favorites (2)'), findsOneWidget);

      await tester.tap(find.byKey(const Key('saved-chip-c1')));
      await tester.pumpAndSettle();
      expect(repo.savedCalls.last.collectionId, 'c1');
    });

    testWidgets('shows an empty state', (tester) async {
      await _pump(tester, FakeCollectionsRepository(), initial: Routes.saved);
      expect(find.textContaining('No saved places yet'), findsOneWidget);
    });

    testWidgets('shows an error with retry', (tester) async {
      final repo = FakeCollectionsRepository()..error = serverFailure;
      await _pump(tester, repo, initial: Routes.saved);
      expect(find.text('Try again'), findsOneWidget);

      repo
        ..error = null
        ..savedPages = [
          [savedItem('z')],
        ];
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(find.text('Saved z'), findsWidgets);
    });

    testWidgets('tapping a card opens the place', (tester) async {
      final repo = FakeCollectionsRepository()
        ..savedPages = [
          [savedItem('a')],
        ];
      final router = await _pump(tester, repo, initial: Routes.saved);
      await tester.tap(find.text('Saved a').last);
      await tester.pumpAndSettle();
      expect(router.state.uri.path, Routes.place('a'));
    });

    testWidgets('the folder button opens collections management', (
      tester,
    ) async {
      final router = await _pump(
        tester,
        FakeCollectionsRepository(),
        initial: Routes.saved,
      );
      await tester.tap(find.byKey(const Key('manage-collections')));
      await tester.pumpAndSettle();
      expect(router.state.uri.path, Routes.collections);
      expect(find.text('Favorites'), findsOneWidget);
    });
  });

  group('Collections screen', () {
    testWidgets('creates, renames and deletes a collection', (tester) async {
      final repo = FakeCollectionsRepository();
      await _pump(tester, repo, initial: Routes.collections);
      expect(find.text('Favorites'), findsOneWidget);
      expect(find.text('2 places'), findsOneWidget);

      await tester.tap(find.byKey(const Key('collection-new')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('collection-name')), 'Food');
      await tester.tap(find.byKey(const Key('collection-save')));
      await tester.pumpAndSettle();
      expect(find.text('Food'), findsOneWidget);

      await tester.tap(find.byKey(const Key('collection-menu-c2')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Edit'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('collection-name')), 'Trips');
      await tester.tap(find.byKey(const Key('collection-save')));
      await tester.pumpAndSettle();
      expect(find.text('Trips'), findsOneWidget);
      expect(find.text('Weekend'), findsNothing);

      await tester.tap(find.byKey(const Key('collection-menu-c2')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Delete'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('collection-confirm-delete')));
      await tester.pumpAndSettle();
      expect(find.text('Trips'), findsNothing);
      expect(repo.deleted, ['c2']);
    });

    testWidgets('a failed create shows a message and keeps the list', (
      tester,
    ) async {
      final repo = FakeCollectionsRepository();
      await _pump(tester, repo, initial: Routes.collections);
      repo.error = serverFailure;

      await tester.tap(find.byKey(const Key('collection-new')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('collection-name')), 'X');
      await tester.tap(find.byKey(const Key('collection-save')));
      await tester.pumpAndSettle();

      expect(find.byType(SnackBar), findsOneWidget);
      expect(find.text('Favorites'), findsOneWidget);
    });

    testWidgets('shows the empty state', (tester) async {
      final repo = FakeCollectionsRepository()..collections = [];
      await _pump(tester, repo, initial: Routes.collections);
      expect(find.textContaining('No collections yet'), findsOneWidget);
    });

    testWidgets('opens a collection to see its places', (tester) async {
      final repo = FakeCollectionsRepository()
        ..savedPages = [
          [savedItem('a')],
        ];
      await _pump(tester, repo, initial: Routes.collections);
      await tester.tap(find.byKey(const Key('collection-c1')));
      await tester.pumpAndSettle();
      expect(repo.savedCalls.last.collectionId, 'c1');
      expect(find.text('Saved a'), findsWidgets);
    });
  });

  group('Save button + sheet', () {
    final place = samplePlace('p1', name: 'Cafe A');

    Widget host() => Scaffold(
      body: Center(child: SaveButton(place: place)),
    );

    testWidgets('saves a place into the picked collections', (tester) async {
      final repo = FakeCollectionsRepository();
      await _pump(tester, repo, initial: '/', home: host());

      await tester.tap(find.byKey(const Key('save-p1')));
      await tester.pumpAndSettle();
      expect(find.text('Save to collection'), findsOneWidget);

      await tester.tap(find.byKey(const Key('pick-c1')));
      await tester.tap(find.byKey(const Key('pick-c2')));
      await tester.tap(find.byKey(const Key('save-memberships')));
      await tester.pumpAndSettle();

      expect(repo.added.toSet(), {('c1', 'p1'), ('c2', 'p1')});
      expect(find.text('Save to collection'), findsNothing);
      expect(find.byIcon(Icons.favorite), findsOneWidget);
    });

    testWidgets('shows the heart filled for an already saved place', (
      tester,
    ) async {
      final repo = FakeCollectionsRepository()..membership['p1'] = ['c1'];
      await _pump(tester, repo, initial: '/', home: host());
      expect(find.byIcon(Icons.favorite), findsOneWidget);

      await tester.tap(find.byKey(const Key('save-p1')));
      await tester.pumpAndSettle();
      final tile = tester.widget<CheckboxListTile>(
        find.byKey(const Key('pick-c1')),
      );
      expect(tile.value, isTrue);

      await tester.tap(find.byKey(const Key('pick-c1')));
      await tester.tap(find.byKey(const Key('save-memberships')));
      await tester.pumpAndSettle();
      expect(repo.removed, [('c1', 'p1')]);
      expect(find.byIcon(Icons.favorite_border), findsOneWidget);
    });

    testWidgets('creates a collection from the sheet and selects it', (
      tester,
    ) async {
      final repo = FakeCollectionsRepository();
      await _pump(tester, repo, initial: '/', home: host());
      await tester.tap(find.byKey(const Key('save-p1')));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('new-collection-name')),
        'Beaches',
      );
      await tester.pump(); // rebuild so the Create button enables
      await tester.tap(find.byKey(const Key('create-collection')));
      await tester.pumpAndSettle();

      expect(find.text('Beaches'), findsOneWidget);
      final newId = repo.collections.first.id;
      final tile = tester.widget<CheckboxListTile>(
        find.byKey(Key('pick-$newId')),
      );
      expect(tile.value, isTrue);
    });

    testWidgets('a failed save keeps the sheet open with a message', (
      tester,
    ) async {
      final repo = FakeCollectionsRepository();
      await _pump(tester, repo, initial: '/', home: host());
      await tester.tap(find.byKey(const Key('save-p1')));
      await tester.pumpAndSettle();

      repo.addError = serverFailure;
      await tester.tap(find.byKey(const Key('pick-c1')));
      await tester.tap(find.byKey(const Key('save-memberships')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('save-error')), findsOneWidget);
      expect(find.text('Save to collection'), findsOneWidget);
    });
  });
}
