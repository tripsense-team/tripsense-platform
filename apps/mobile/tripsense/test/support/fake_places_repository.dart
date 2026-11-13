import 'package:trip/core/errors/app_failure.dart';
import 'package:trip/features/places/domain/place.dart';
import 'package:trip/features/places/domain/places_repository.dart';

Place samplePlace(String id, {String? name, String? hours}) => Place(
  id: id,
  name: name ?? 'Place $id',
  address: '1 Main St',
  categories: const ['coffee_shop'],
  rating: 4.5,
  ratingCount: 120,
  openingHours: hours,
);

class SearchCall {
  SearchCall(this.query, this.category, this.near);
  final String query;
  final PlaceCategory? category;
  final GeoPoint? near;
}

/// Scriptable [PlacesRepository]; records calls for assertions.
class FakePlacesRepository implements PlacesRepository {
  List<Place> searchResult = [samplePlace('s1')];
  List<Place> feedResult = [samplePlace('f1')];
  List<PlaceSuggestion> suggestions = const [];
  Place? detailsResult;
  Object? feedError;
  Object? searchError;
  Object? detailsError;

  final searchCalls = <SearchCall>[];
  final feedCalls = <String>[];
  final autocompleteCalls = <String>[];

  @override
  Future<List<Place>> search({
    required String query,
    PlaceCategory? category,
    GeoPoint? near,
    int limit = 20,
  }) async {
    searchCalls.add(SearchCall(query, category, near));
    if (searchError != null) throw searchError!;
    return searchResult;
  }

  @override
  Future<List<PlaceSuggestion>> autocomplete(
    String query, {
    GeoPoint? near,
    int limit = 5,
  }) async {
    autocompleteCalls.add(query);
    return suggestions;
  }

  @override
  Future<Place> details(String id, {String? name, GeoPoint? near}) async {
    if (detailsError != null) throw detailsError!;
    return detailsResult ?? samplePlace(id);
  }

  @override
  Future<List<Place>> exploreForYou({
    required String destinationId,
    required String sessionId,
    String? query,
    int limit = 20,
  }) async {
    feedCalls.add(destinationId);
    if (feedError != null) throw feedError!;
    return feedResult;
  }
}

const serverFailure = AppFailure(type: AppFailureType.server);
