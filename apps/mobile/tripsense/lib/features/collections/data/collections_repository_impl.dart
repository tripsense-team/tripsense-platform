import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/gateway_client.dart';
import '../../places/data/place_json.dart';
import '../domain/collections.dart';
import '../domain/collections_repository.dart';

final collectionsRepositoryProvider = Provider<CollectionsRepository>(
  (ref) => CollectionsRepositoryImpl(ref.watch(gatewayClientProvider)),
);

const _base = '/api/places/me';

String _text(Object? value) => value is String ? value : '';

List<String> _ids(Object? value) =>
    value is List ? [for (final v in value) v.toString()] : const [];

PlaceCollection _collection(Map<String, dynamic> json) => PlaceCollection(
  id: _text(json['id']),
  name: _text(json['name']),
  placeCount: json['placeCount'] is num
      ? (json['placeCount'] as num).toInt()
      : 0,
);

class CollectionsRepositoryImpl implements CollectionsRepository {
  CollectionsRepositoryImpl(this._dio);

  final Dio _dio;

  Object? _data(Response<Map<String, dynamic>> response) =>
      response.data?['data'];

  String _placePath(String collectionId, String placeRef) =>
      '$_base/collections/${Uri.encodeComponent(collectionId)}'
      '/places/${Uri.encodeComponent(placeRef)}';

  @override
  Future<List<PlaceCollection>> list() => guardApi(() async {
    final response = await _dio.get<Map<String, dynamic>>('$_base/collections');
    return [for (final item in jsonList(_data(response))) _collection(item)];
  });

  @override
  Future<PlaceCollection> create(String name) => guardApi(() async {
    final response = await _dio.post<Map<String, dynamic>>(
      '$_base/collections',
      data: {'name': name.trim()},
    );
    return _collection(jsonMap(_data(response)) ?? const {});
  });

  @override
  Future<PlaceCollection> rename(String id, String name) => guardApi(() async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '$_base/collections/${Uri.encodeComponent(id)}',
      data: {'name': name.trim()},
    );
    return _collection(jsonMap(_data(response)) ?? const {});
  });

  @override
  Future<void> delete(String id) => guardApi(() async {
    await _dio.delete<Object?>('$_base/collections/${Uri.encodeComponent(id)}');
  });

  @override
  Future<List<SavedStatus>> statuses(List<String> placeRefs) {
    if (placeRefs.isEmpty) return Future.value(const []);
    return guardApi(() async {
      final response = await _dio.post<Map<String, dynamic>>(
        '$_base/saved-status:batch',
        data: {'placeRefs': placeRefs},
      );
      final data = jsonMap(_data(response));
      return [
        for (final item in jsonList(data?['items']))
          SavedStatus(
            placeRef: _text(item['placeRef']),
            collectionIds: _ids(item['collectionIds']),
          ),
      ];
    });
  }

  @override
  Future<void> addPlace(String collectionId, String placeRef) =>
      guardApi(() async {
        await _dio.put<Object?>(_placePath(collectionId, placeRef));
      });

  @override
  Future<void> removePlace(String collectionId, String placeRef) =>
      guardApi(() async {
        await _dio.delete<Object?>(_placePath(collectionId, placeRef));
      });

  @override
  Future<SavedPage> saved({
    String? collectionId,
    int page = 0,
    int size = 20,
  }) => guardApi(() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '$_base/saved',
      queryParameters: {
        'page': page,
        'size': size,
        'collectionId': ?collectionId,
      },
    );
    final data = jsonMap(_data(response));
    return SavedPage(
      items: [
        for (final item in jsonList(data?['content']))
          if (jsonMap(item['place']) case final place?)
            SavedPlaceItem(
              placeRef: _text(item['placeRef']),
              place: placeFromJson(place),
              collectionIds: _ids(item['collectionIds']),
            ),
      ],
      page: data?['page'] is num ? (data!['page'] as num).toInt() : page,
      totalPages: data?['totalPages'] is num
          ? (data!['totalPages'] as num).toInt()
          : 1,
    );
  });
}
