import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/session_controller.dart';
import '../data/collections_repository_impl.dart';
import '../domain/collections.dart';
import '../domain/collections_repository.dart';

/// Signed-in user id; every saved-places provider depends on it so data
/// never leaks from one account to the next.
final signedInUserIdProvider = Provider<String?>(
  (ref) => switch (ref.watch(sessionControllerProvider)) {
    SessionAuthenticated(:final user) => user.id,
    _ => null,
  },
);

CollectionsRepository _repo(Ref ref) => ref.read(collectionsRepositoryProvider);

/// The user's collections (newest first, as returned by the server).
class CollectionsController extends AsyncNotifier<List<PlaceCollection>> {
  @override
  Future<List<PlaceCollection>> build() {
    if (ref.watch(signedInUserIdProvider) == null) {
      return Future.value(const []);
    }
    return _repo(ref).list();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_repo(ref).list);
  }

  /// Throws `AppFailure` so the calling sheet can show the message.
  Future<PlaceCollection> create(String name) async {
    final created = await _repo(ref).create(name);
    state = AsyncData([created, ...?state.value]);
    return created;
  }

  Future<void> rename(String id, String name) async {
    final updated = await _repo(ref).rename(id, name);
    state = AsyncData([
      for (final c in state.value ?? const <PlaceCollection>[])
        if (c.id == id) updated else c,
    ]);
  }

  Future<void> delete(String id) async {
    await _repo(ref).delete(id);
    state = AsyncData([
      for (final c in state.value ?? const <PlaceCollection>[])
        if (c.id != id) c,
    ]);
    // Saved lists and statuses referenced this collection.
    ref.invalidate(savedStatusProvider);
    ref.invalidate(savedPlacesProvider);
  }
}

final collectionsControllerProvider =
    AsyncNotifierProvider<CollectionsController, List<PlaceCollection>>(
      CollectionsController.new,
      // Show the error + retry button instead of silently retrying.
      retry: (_, _) => null,
    );

/// placeRef -> collection ids it is saved in. Missing key = not loaded yet.
class SavedStatusController extends Notifier<Map<String, List<String>>> {
  final _pending = <String>{};
  bool _flushScheduled = false;

  @override
  Map<String, List<String>> build() {
    ref.watch(signedInUserIdProvider);
    _pending.clear();
    return const {};
  }

  bool isSaved(String placeRef) => state[placeRef]?.isNotEmpty ?? false;

  /// Queues [placeRefs] for one batched status lookup (failures are silent:
  /// the heart just stays empty until the next attempt).
  void request(Iterable<String> placeRefs) {
    if (ref.read(signedInUserIdProvider) == null) return;
    for (final placeRef in placeRefs) {
      if (!state.containsKey(placeRef)) _pending.add(placeRef);
    }
    if (_pending.isEmpty || _flushScheduled) return;
    _flushScheduled = true;
    scheduleMicrotask(_flush);
  }

  Future<void> _flush() async {
    _flushScheduled = false;
    if (!ref.mounted || _pending.isEmpty) return;
    final batch = _pending.toList();
    _pending.clear();
    try {
      final statuses = await _repo(ref).statuses(batch);
      if (!ref.mounted) return;
      state = {
        ...state,
        for (final s in statuses) s.placeRef: s.collectionIds,
        // Refs the server did not report are simply "not saved".
        for (final r in batch)
          if (!statuses.any((s) => s.placeRef == r)) r: const <String>[],
      };
    } on Object {
      // Leave unknown; the next request() retries.
    }
  }

  /// Makes [placeRef] belong to exactly [selected] collections.
  /// Throws `AppFailure` on the first failed call (state is re-read from the server).
  Future<void> update(String placeRef, Set<String> selected) async {
    final before = state[placeRef] ?? const [];
    final diff = diffMemberships(before, selected);
    final repo = _repo(ref);
    try {
      for (final id in diff.add) {
        await repo.addPlace(id, placeRef);
      }
      for (final id in diff.remove) {
        await repo.removePlace(id, placeRef);
      }
      if (ref.mounted) state = {...state, placeRef: selected.toList()};
    } finally {
      if (ref.mounted) {
        // Counts and saved lists changed (also after a partial failure).
        ref.invalidate(collectionsControllerProvider);
        ref.invalidate(savedPlacesProvider);
        if (state.containsKey(placeRef)) {
          state = Map.of(state)..remove(placeRef);
          request([placeRef]);
        }
      }
    }
  }
}

final savedStatusProvider =
    NotifierProvider<SavedStatusController, Map<String, List<String>>>(
      SavedStatusController.new,
    );

class SavedListState {
  const SavedListState({
    required this.items,
    required this.page,
    required this.hasMore,
  });

  final List<SavedPlaceItem> items;
  final int page;
  final bool hasMore;
}

/// Saved places for one collection (null = all), loaded page by page.
class SavedPlacesController extends AsyncNotifier<SavedListState> {
  SavedPlacesController(this.collectionId);

  final String? collectionId;
  bool _loadingMore = false;

  static const pageSize = 20;

  @override
  Future<SavedListState> build() async {
    if (ref.watch(signedInUserIdProvider) == null) {
      return const SavedListState(items: [], page: 0, hasMore: false);
    }
    final page = await _repo(
      ref,
    ).saved(collectionId: collectionId, size: pageSize);
    return SavedListState(
      items: page.items,
      page: page.page,
      hasMore: page.hasMore,
    );
  }

  Future<void> refresh() async {
    ref.invalidateSelf();
    await future;
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || _loadingMore) return;
    _loadingMore = true;
    try {
      final next = await _repo(ref).saved(
        collectionId: collectionId,
        page: current.page + 1,
        size: pageSize,
      );
      if (!ref.mounted) return;
      state = AsyncData(
        SavedListState(
          items: [...current.items, ...next.items],
          page: next.page,
          hasMore: next.hasMore,
        ),
      );
    } on Object {
      // Keep what is shown; the user can scroll again to retry.
    } finally {
      _loadingMore = false;
    }
  }
}

final savedPlacesProvider = AsyncNotifierProvider.autoDispose
    .family<SavedPlacesController, SavedListState, String?>(
      SavedPlacesController.new,
      retry: (_, _) => null,
    );
