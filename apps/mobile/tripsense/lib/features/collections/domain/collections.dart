import '../../places/domain/place.dart';

class PlaceCollection {
  const PlaceCollection({
    required this.id,
    required this.name,
    this.placeCount = 0,
  });

  final String id;
  final String name;
  final int placeCount;
}

/// Which collections a place already belongs to (empty = not saved).
class SavedStatus {
  const SavedStatus({required this.placeRef, this.collectionIds = const []});

  final String placeRef;
  final List<String> collectionIds;

  bool get saved => collectionIds.isNotEmpty;
}

class SavedPlaceItem {
  const SavedPlaceItem({
    required this.placeRef,
    required this.place,
    this.collectionIds = const [],
  });

  final String placeRef;
  final Place place;
  final List<String> collectionIds;
}

class SavedPage {
  const SavedPage({
    required this.items,
    required this.page,
    required this.totalPages,
  });

  final List<SavedPlaceItem> items;
  final int page;
  final int totalPages;

  bool get hasMore => page + 1 < totalPages;
}

/// Collection ids to add / remove so [before] becomes [after].
({List<String> add, List<String> remove}) diffMemberships(
  Iterable<String> before,
  Iterable<String> after,
) {
  final b = before.toSet();
  final a = after.toSet();
  return (add: a.difference(b).toList(), remove: b.difference(a).toList());
}

/// Max collection name length enforced by the web form.
const maxCollectionNameLength = 80;
