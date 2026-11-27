import 'dart:async';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/places_repository_impl.dart';
import '../domain/destinations.dart';
import '../domain/place.dart';
import '../domain/places_repository.dart';

class ExploreState {
  const ExploreState({
    required this.destination,
    this.tab = ExploreTab.forYou,
    this.query = '',
    this.places = const AsyncLoading(),
    this.usedFallback = false,
  });

  final DestinationPreset destination;
  final ExploreTab tab;

  /// Free-text search; empty means "browse by tab".
  final String query;
  final AsyncValue<List<Place>> places;

  /// True when the personalized feed failed/was empty and popular places show.
  final bool usedFallback;

  bool get isSearching => query.isNotEmpty;

  ExploreState copyWith({
    DestinationPreset? destination,
    ExploreTab? tab,
    String? query,
    AsyncValue<List<Place>>? places,
    bool? usedFallback,
  }) => ExploreState(
    destination: destination ?? this.destination,
    tab: tab ?? this.tab,
    query: query ?? this.query,
    places: places ?? this.places,
    usedFallback: usedFallback ?? this.usedFallback,
  );
}

String _newSessionId() {
  final random = Random.secure();
  return List.generate(
    16,
    (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'),
  ).join();
}

class ExploreController extends Notifier<ExploreState> {
  late final String _sessionId = _newSessionId();
  int _request = 0;

  PlacesRepository get _repo => ref.read(placesRepositoryProvider);

  @override
  ExploreState build() {
    final initial = ExploreState(destination: destinationPresets.first);
    Future.microtask(_load);
    return initial;
  }

  void selectDestination(DestinationPreset destination) {
    if (destination.id == state.destination.id) return;
    state = state.copyWith(destination: destination);
    _load();
  }

  void selectTab(ExploreTab tab) {
    // Picking a tab leaves search mode, like the web chips.
    if (tab == state.tab && !state.isSearching) return;
    state = state.copyWith(tab: tab, query: '');
    _load();
  }

  void search(String query) {
    final text = query.trim();
    if (text.isEmpty) return clearSearch();
    state = state.copyWith(query: text);
    _load();
  }

  void clearSearch() {
    if (!state.isSearching) return;
    state = state.copyWith(query: '');
    _load();
  }

  Future<void> refresh() => _load();

  Future<void> _load() async {
    final id = ++_request;
    final current = state;
    state = current.copyWith(places: const AsyncLoading(), usedFallback: false);

    final result = await AsyncValue.guard(() => _fetch(current));
    // A newer request started meanwhile: drop this stale answer.
    if (id != _request || !ref.mounted) return;

    state = switch (result) {
      AsyncData(:final value) => state.copyWith(
        places: AsyncData(value.places),
        usedFallback: value.usedFallback,
      ),
      AsyncError(:final error, :final stackTrace) => state.copyWith(
        places: AsyncError(error, stackTrace),
      ),
      _ => state,
    };
  }

  Future<({List<Place> places, bool usedFallback})> _fetch(
    ExploreState s,
  ) async {
    final near = GeoPoint(s.destination.lat, s.destination.lng);

    if (s.isSearching) {
      final places = await _repo.search(
        query: buildSearchQuery(s.query, s.destination),
        category: s.tab.category,
        near: near,
      );
      return (places: places, usedFallback: false);
    }

    if (s.tab == ExploreTab.forYou) {
      try {
        final feed = await _repo.exploreForYou(
          destinationId: s.destination.id,
          sessionId: _sessionId,
        );
        if (feed.isNotEmpty) return (places: feed, usedFallback: false);
      } on Object {
        // Personalization is optional: fall through to popular places.
      }
      final places = await _repo.search(
        query: s.destination.defaultQuery,
        near: near,
      );
      return (places: places, usedFallback: true);
    }

    final places = await _repo.search(
      query: buildSearchQuery(s.tab.queryKeyword, s.destination),
      category: s.tab.category,
      near: near,
    );
    return (places: places, usedFallback: false);
  }
}

final exploreControllerProvider =
    NotifierProvider<ExploreController, ExploreState>(ExploreController.new);

/// Search-as-you-type suggestions: 300 ms debounce, min 2 chars, stale answers dropped.
class AutocompleteController
    extends Notifier<AsyncValue<List<PlaceSuggestion>>> {
  Timer? _timer;
  int _request = 0;

  static const debounce = Duration(milliseconds: 300);
  static const minChars = 2;

  @override
  AsyncValue<List<PlaceSuggestion>> build() {
    ref.onDispose(() => _timer?.cancel());
    return const AsyncData([]);
  }

  void onQueryChanged(String raw, DestinationPreset destination) {
    _timer?.cancel();
    final id = ++_request;
    final text = raw.trim();
    if (text.length < minChars) {
      state = const AsyncData([]);
      return;
    }
    _timer = Timer(debounce, () async {
      final result = await AsyncValue.guard(
        () => ref
            .read(placesRepositoryProvider)
            .autocomplete(
              text,
              near: GeoPoint(destination.lat, destination.lng),
            ),
      );
      if (id != _request || !ref.mounted) return;
      state = result;
    });
  }

  void clear() {
    _timer?.cancel();
    _request++;
    state = const AsyncData([]);
  }
}

final autocompleteControllerProvider =
    NotifierProvider.autoDispose<
      AutocompleteController,
      AsyncValue<List<PlaceSuggestion>>
    >(AutocompleteController.new);
