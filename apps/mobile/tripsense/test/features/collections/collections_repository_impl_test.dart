import 'package:flutter_test/flutter_test.dart';
import 'package:trip/core/errors/app_failure.dart';
import 'package:trip/features/collections/data/collections_repository_impl.dart';
import 'package:trip/features/collections/domain/collections.dart';

import '../../support/fake_http_adapter.dart';

void main() {
  late FakeHttpAdapter adapter;
  late CollectionsRepositoryImpl repo;
  var status = 200;

  setUp(() {
    status = 200;
    adapter = FakeHttpAdapter((o) {
      if (status != 200) return (status, {'success': false});
      final key = '${o.method} ${o.path}';
      return switch (key) {
        'GET /api/places/me/collections' => (
          200,
          {
            'data': [
              {'id': 'c1', 'name': 'Fav', 'placeCount': 3},
            ],
          },
        ),
        'POST /api/places/me/collections' => (
          200,
          {
            'data': {'id': 'c9', 'name': 'New'},
          },
        ),
        'POST /api/places/me/saved-status:batch' => (
          200,
          {
            'data': {
              'items': [
                {
                  'placeRef': 'p1',
                  'saved': true,
                  'collectionIds': ['c1'],
                },
                {'placeRef': 'p2', 'saved': false, 'collectionIds': <String>[]},
              ],
            },
          },
        ),
        'GET /api/places/me/saved' => (
          200,
          {
            'data': {
              'content': [
                {
                  'placeRef': 'p1',
                  'collectionIds': ['c1'],
                  'place': {'id': 'p1', 'name': 'Cafe'},
                },
                {'placeRef': 'gone', 'place': null},
              ],
              'page': 0,
              'totalPages': 2,
            },
          },
        ),
        _ => (200, {'success': true}),
      };
    });
    repo = CollectionsRepositoryImpl(dioWith(adapter));
  });

  test('list maps collections', () async {
    final result = await repo.list();
    expect(result.single.name, 'Fav');
    expect(result.single.placeCount, 3);
  });

  test('create trims the name and returns the new collection', () async {
    final created = await repo.create('  New  ');
    expect(created.id, 'c9');
    expect((adapter.requests.single.data as Map)['name'], 'New');
  });

  test('rename uses PATCH and delete uses DELETE on the id', () async {
    await repo.rename('c 1', 'X');
    await repo.delete('c 1');
    expect(adapter.requests[0].method, 'PATCH');
    expect(adapter.requests[0].path, '/api/places/me/collections/c%201');
    expect(adapter.requests[1].method, 'DELETE');
  });

  test('statuses sends one batch and skips empty input', () async {
    expect(await repo.statuses([]), isEmpty);
    expect(adapter.requests, isEmpty);

    final result = await repo.statuses(['p1', 'p2']);
    expect(result[0].saved, isTrue);
    expect(result[1].saved, isFalse);
    expect((adapter.requests.single.data as Map)['placeRefs'], ['p1', 'p2']);
  });

  test('addPlace / removePlace encode ids in the path', () async {
    await repo.addPlace('c1', 'place/ref 1');
    await repo.removePlace('c1', 'place/ref 1');
    expect(adapter.requests[0].method, 'PUT');
    expect(
      adapter.requests[0].path,
      '/api/places/me/collections/c1/places/place%2Fref%201',
    );
    expect(adapter.requests[1].method, 'DELETE');
  });

  test('saved parses a page, skipping entries without a place', () async {
    final page = await repo.saved(collectionId: 'c1', size: 10);
    expect(page.items.single.place.name, 'Cafe');
    expect(page.hasMore, isTrue);
    final q = adapter.requests.single.queryParameters;
    expect(q['collectionId'], 'c1');
    expect(q['size'], 10);
  });

  test('errors become AppFailure', () async {
    status = 403;
    await expectLater(
      repo.list(),
      throwsA(
        isA<AppFailure>().having(
          (f) => f.type,
          'type',
          AppFailureType.forbidden,
        ),
      ),
    );
  });

  test('diffMemberships computes adds and removes', () {
    final diff = diffMemberships(['a', 'b'], {'b', 'c'});
    expect(diff.add, ['c']);
    expect(diff.remove, ['a']);
  });
}
