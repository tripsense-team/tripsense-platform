import 'package:trip/features/collections/domain/collections.dart';
import 'package:trip/features/collections/domain/collections_repository.dart';
import 'package:trip/features/places/domain/place.dart';

import 'fake_places_repository.dart';

/// In-memory [CollectionsRepository]; records calls and can be told to fail.
class FakeCollectionsRepository implements CollectionsRepository {
  List<PlaceCollection> collections = [
    const PlaceCollection(id: 'c1', name: 'Favorites', placeCount: 2),
    const PlaceCollection(id: 'c2', name: 'Weekend', placeCount: 0),
  ];

  /// placeRef -> collection ids.
  final membership = <String, List<String>>{};

  /// Pages returned by [saved], indexed by page number.
  List<List<SavedPlaceItem>> savedPages = [];

  Object? error;
  Object? addError;

  final statusCalls = <List<String>>[];
  final added = <(String, String)>[];
  final removed = <(String, String)>[];
  final savedCalls = <({String? collectionId, int page})>[];
  final deleted = <String>[];

  void _maybeFail() {
    if (error != null) throw error!;
  }

  @override
  Future<List<PlaceCollection>> list() async {
    _maybeFail();
    return collections;
  }

  @override
  Future<PlaceCollection> create(String name) async {
    _maybeFail();
    final created = PlaceCollection(
      id: 'new-${collections.length}',
      name: name,
    );
    collections = [created, ...collections];
    return created;
  }

  @override
  Future<PlaceCollection> rename(String id, String name) async {
    _maybeFail();
    final old = collections.firstWhere((c) => c.id == id);
    final updated = PlaceCollection(
      id: id,
      name: name,
      placeCount: old.placeCount,
    );
    collections = [for (final c in collections) c.id == id ? updated : c];
    return updated;
  }

  @override
  Future<void> delete(String id) async {
    _maybeFail();
    deleted.add(id);
    collections = [
      for (final c in collections)
        if (c.id != id) c,
    ];
  }

  @override
  Future<List<SavedStatus>> statuses(List<String> placeRefs) async {
    statusCalls.add(placeRefs);
    _maybeFail();
    return [
      for (final r in placeRefs)
        SavedStatus(placeRef: r, collectionIds: membership[r] ?? const []),
    ];
  }

  @override
  Future<void> addPlace(String collectionId, String placeRef) async {
    if (addError != null) throw addError!;
    added.add((collectionId, placeRef));
    membership[placeRef] = [...?membership[placeRef], collectionId];
  }

  @override
  Future<void> removePlace(String collectionId, String placeRef) async {
    removed.add((collectionId, placeRef));
    membership[placeRef] = [
      for (final c in membership[placeRef] ?? const <String>[])
        if (c != collectionId) c,
    ];
  }

  @override
  Future<SavedPage> saved({
    String? collectionId,
    int page = 0,
    int size = 20,
  }) async {
    savedCalls.add((collectionId: collectionId, page: page));
    _maybeFail();
    if (savedPages.isEmpty) {
      return const SavedPage(items: [], page: 0, totalPages: 1);
    }
    return SavedPage(
      items: savedPages[page],
      page: page,
      totalPages: savedPages.length,
    );
  }
}

SavedPlaceItem savedItem(
  String id, {
  List<String> collections = const ['c1'],
}) => SavedPlaceItem(
  placeRef: id,
  place: samplePlace(id, name: 'Saved $id'),
  collectionIds: collections,
);

Place unusedPlace() => samplePlace('unused');
