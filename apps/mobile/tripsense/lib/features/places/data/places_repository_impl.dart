import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/gateway_client.dart';
import '../domain/place.dart';
import '../domain/places_repository.dart';
import 'place_json.dart';

final placesRepositoryProvider = Provider<PlacesRepository>(
  (ref) => PlacesRepositoryImpl(ref.watch(gatewayClientProvider)),
);

class PlacesRepositoryImpl implements PlacesRepository {
  PlacesRepositoryImpl(this._dio);

  final Dio _dio;

  /// place-service answers `{success, data, meta}`.
  Object? _data(Response<Map<String, dynamic>> response) =>
      response.data?['data'];

  @override
  Future<List<Place>> search({
    required String query,
    PlaceCategory? category,
    GeoPoint? near,
    int limit = 20,
  }) {
    final text = query.trim();
    if (text.isEmpty) return Future.value(const []);
    return guardApi(() async {
      final response = await _dio.get<Map<String, dynamic>>(
        '/api/places/search',
        queryParameters: {
          'q': text,
          'limit': limit,
          'category': ?category?.apiValue,
          'lat': ?near?.lat,
          'lng': ?near?.lng,
        },
      );
      return [for (final item in jsonList(_data(response))) placeFromJson(item)];
    });
  }

  @override
  Future<List<PlaceSuggestion>> autocomplete(
    String query, {
    GeoPoint? near,
    int limit = 5,
  }) {
    final text = query.trim();
    if (text.isEmpty) return Future.value(const []);
    return guardApi(() async {
      final response = await _dio.get<Map<String, dynamic>>(
        '/api/places/autocomplete',
        queryParameters: {
          'q': text,
          'limit': limit,
          'lat': ?near?.lat,
          'lng': ?near?.lng,
        },
      );
      return [
        for (final item in jsonList(_data(response))) suggestionFromJson(item),
      ];
    });
  }

  @override
  Future<Place> details(String id, {String? name, GeoPoint? near}) =>
      guardApi(() async {
        final response = await _dio.get<Map<String, dynamic>>(
          '/api/places/${Uri.encodeComponent(id)}',
          queryParameters: {
            'name': ?name,
            'lat': ?near?.lat,
            'lng': ?near?.lng,
          },
        );
        return placeFromJson(jsonMap(_data(response)) ?? const {});
      });

  @override
  Future<List<Place>> exploreForYou({
    required String destinationId,
    required String sessionId,
    String? query,
    int limit = 20,
  }) => guardApi(() async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/recommendations/explore-for-you',
      data: {
        'destinationId': destinationId,
        'query': (query == null || query.trim().isEmpty) ? null : query.trim(),
        'sessionId': sessionId,
        'limit': limit,
      },
    );
    final data = jsonMap(_data(response));
    return [
      for (final item in jsonList(data?['items']))
        if (jsonMap(item['place']) case final place?) placeFromJson(place),
    ];
  });
}
