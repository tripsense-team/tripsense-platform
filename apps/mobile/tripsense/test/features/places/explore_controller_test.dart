import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trip/features/places/data/places_repository_impl.dart';
import 'package:trip/features/places/domain/destinations.dart';
import 'package:trip/features/places/domain/place.dart';
import 'package:trip/features/places/presentation/explore_controller.dart';

import '../../support/fake_places_repository.dart';

ProviderContainer _container(FakePlacesRepository repo) {
  final c = ProviderContainer(
    overrides: [placesRepositoryProvider.overrideWithValue(repo)],
  );
  addTearDown(c.dispose);
  return c;
}

Future<void> _settle() => Future<void>.delayed(Duration.zero);

Future<ExploreState> _loaded(ProviderContainer c) async {
  c.listen(exploreControllerProvider, (_, _) {});
  await _settle();
  await _settle();
  return c.read(exploreControllerProvider);
}

void main() {
  test('For you loads the personalized feed for the first destination', () async {
    final repo = FakePlacesRepository();
    final state = await _loaded(_container(repo));
    expect(state.places.value!.single.id, 'f1');
    expect(state.usedFallback, isFalse);
    expect(repo.feedCalls, ['danang']);
  });

  test('falls back to popular places when the feed fails', () async {
    final repo = FakePlacesRepository()..feedError = serverFailure;
    final state = await _loaded(_container(repo));
    expect(state.usedFallback, isTrue);
    expect(state.places.value!.single.id, 's1');
    expect(
      repo.searchCalls.single.query,
      destinationPresets.first.defaultQuery,
    );
  });

  test('falls back when the feed is empty', () async {
    final repo = FakePlacesRepository()..feedResult = [];
    final state = await _loaded(_container(repo));
    expect(state.usedFallback, isTrue);
  });

  test('category tabs search with category and destination', () async {
    final repo = FakePlacesRepository();
    final c = _container(repo);
    await _loaded(c);
    c.read(exploreControllerProvider.notifier).selectTab(ExploreTab.cafes);
    await _settle();
    final call = repo.searchCalls.last;
    expect(call.category, PlaceCategory.cafe);
    expect(call.query, 'quán cà phê ở Đà Nẵng');
    expect(call.near, isNotNull);
  });

  test('search and clearSearch switch modes', () async {
    final repo = FakePlacesRepository();
    final c = _container(repo);
    await _loaded(c);
    final notifier = c.read(exploreControllerProvider.notifier);

    notifier.search('  bánh mì ');
    await _settle();
    expect(c.read(exploreControllerProvider).query, 'bánh mì');
    expect(repo.searchCalls.last.query, 'bánh mì ở Đà Nẵng');

    notifier.clearSearch();
    await _settle();
    expect(c.read(exploreControllerProvider).isSearching, isFalse);
    expect(repo.feedCalls.length, 2);
  });

  test('changing destination reloads', () async {
    final repo = FakePlacesRepository();
    final c = _container(repo);
    await _loaded(c);
    c
        .read(exploreControllerProvider.notifier)
        .selectDestination(destinationPresets[1]);
    await _settle();
    expect(repo.feedCalls, ['danang', 'hue']);
  });

  test('a search failure surfaces as an error state', () async {
    final repo = FakePlacesRepository()..searchError = serverFailure;
    final c = _container(repo);
    await _loaded(c);
    c.read(exploreControllerProvider.notifier).search('x');
    await _settle();
    expect(c.read(exploreControllerProvider).places.hasError, isTrue);
  });

  test('stale answers are dropped', () async {
    final repo = _SlowRepo();
    final c = _container(repo);
    c.listen(exploreControllerProvider, (_, _) {});
    await _settle();
    final notifier = c.read(exploreControllerProvider.notifier);
    notifier.search('first');
    await _settle();
    notifier.search('second');
    await _settle();
    repo.complete('second', [samplePlace('new')]);
    await _settle();
    repo.complete('first', [samplePlace('old')]);
    await _settle();
    expect(c.read(exploreControllerProvider).places.value!.single.id, 'new');
  });

  group('autocomplete', () {
    test('needs 2 chars and debounces to the last keystroke', () async {
      final repo = FakePlacesRepository()
        ..suggestions = const [PlaceSuggestion(id: '1', title: 'Cafe')];
      final c = _container(repo);
      c.listen(autocompleteControllerProvider, (_, _) {});
      final n = c.read(autocompleteControllerProvider.notifier);
      final dest = destinationPresets.first;

      n.onQueryChanged('c', dest);
      await Future<void>.delayed(AutocompleteController.debounce * 1.3);
      expect(repo.autocompleteCalls, isEmpty);

      n.onQueryChanged('ca', dest);
      n.onQueryChanged('caf', dest);
      await Future<void>.delayed(AutocompleteController.debounce * 1.5);
      expect(repo.autocompleteCalls, ['caf']);
      expect(
        c.read(autocompleteControllerProvider).value!.single.title,
        'Cafe',
      );

      n.clear();
      expect(c.read(autocompleteControllerProvider).value, isEmpty);
    });
  });
}

/// Search answers only when the test completes them, to force out-of-order replies.
class _SlowRepo extends FakePlacesRepository {
  final _pending = <String, Completer<List<Place>>>{};

  void complete(String key, List<Place> places) => _pending.entries
      .firstWhere((e) => e.key.startsWith(key))
      .value
      .complete(places);

  @override
  Future<List<Place>> search({
    required String query,
    PlaceCategory? category,
    GeoPoint? near,
    int limit = 20,
  }) {
    final completer = Completer<List<Place>>();
    _pending[query] = completer;
    return completer.future;
  }

  @override
  Future<List<Place>> exploreForYou({
    required String destinationId,
    required String sessionId,
    String? query,
    int limit = 20,
  }) async => [samplePlace('feed')];
}
