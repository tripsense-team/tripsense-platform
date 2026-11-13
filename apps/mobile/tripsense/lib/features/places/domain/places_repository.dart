import 'place.dart';

/// All methods throw `AppFailure` (never raw Dio errors).
abstract interface class PlacesRepository {
  /// Public text search, optionally filtered by [category] and biased to a point.
  Future<List<Place>> search({
    required String query,
    PlaceCategory? category,
    GeoPoint? near,
    int limit = 20,
  });

  /// Search-as-you-type suggestions.
  Future<List<PlaceSuggestion>> autocomplete(
    String query, {
    GeoPoint? near,
    int limit = 5,
  });

  Future<Place> details(String id, {String? name, GeoPoint? near});

  /// Personalized feed (requires a signed-in user).
  Future<List<Place>> exploreForYou({
    required String destinationId,
    required String sessionId,
    String? query,
    int limit = 20,
  });
}
