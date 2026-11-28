import 'collections.dart';

/// All methods throw `AppFailure` (never raw Dio errors).
abstract interface class CollectionsRepository {
  Future<List<PlaceCollection>> list();

  Future<PlaceCollection> create(String name);

  Future<PlaceCollection> rename(String id, String name);

  Future<void> delete(String id);

  /// Saved state for [placeRefs] in one call.
  Future<List<SavedStatus>> statuses(List<String> placeRefs);

  Future<void> addPlace(String collectionId, String placeRef);

  Future<void> removePlace(String collectionId, String placeRef);

  /// Saved places, optionally limited to one collection.
  Future<SavedPage> saved({String? collectionId, int page = 0, int size = 20});
}
