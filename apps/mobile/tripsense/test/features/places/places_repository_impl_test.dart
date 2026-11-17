import 'package:flutter_test/flutter_test.dart';
import 'package:trip/core/errors/app_failure.dart';
import 'package:trip/features/places/data/places_repository_impl.dart';
import 'package:trip/features/places/domain/place.dart';

import '../../support/fake_http_adapter.dart';

void main() {
  late FakeHttpAdapter adapter;
  late PlacesRepositoryImpl repo;
  var status = 200;

  setUp(() {
    status = 200;
    adapter = FakeHttpAdapter((o) {
      if (status != 200) return (status, {'success': false});
      return switch (o.path) {
        '/api/places/search' => (
          200,
          {
            'success': true,
            'data': [
              {'id': 'p1', 'name': 'A'},
              {'id': 'p2', 'name': 'B'},
            ],
          },
        ),
        '/api/places/autocomplete' => (
          200,
          {
            'data': [
              {'id': 'p1', 'title': 'A', 'subtitle': 'Da Nang'},
            ],
          },
        ),
        '/api/recommendations/explore-for-you' => (
          200,
          {
            'data': {
              'items': [
                {
                  'place': {'id': 'r1', 'name': 'Rec'},
                  'rank': 1,
                },
              ],
            },
          },
        ),
        _ => (
          200,
          {
            'data': {'id': 'p9', 'name': 'Detail', 'phone': '123'},
          },
        ),
      };
    });
    repo = PlacesRepositoryImpl(dioWith(adapter));
  });

  test('search sends query, category and location', () async {
    final result = await repo.search(
      query: 'cafe',
      category: PlaceCategory.cafe,
      near: const GeoPoint(16.0, 108.0),
    );
    expect(result.map((p) => p.id), ['p1', 'p2']);
    final q = adapter.requests.single.queryParameters;
    expect(q['q'], 'cafe');
    expect(q['category'], 'CAFE');
    expect(q['lat'], 16.0);
  });

  test('blank queries never hit the network', () async {
    expect(await repo.search(query: '  '), isEmpty);
    expect(await repo.autocomplete(''), isEmpty);
    expect(adapter.requests, isEmpty);
  });

  test('autocomplete maps suggestions', () async {
    final result = await repo.autocomplete('da');
    expect(result.single.subtitle, 'Da Nang');
  });

  test('details maps a single place', () async {
    final place = await repo.details('p9', name: 'Detail');
    expect(place.phone, '123');
  });

  test('exploreForYou unwraps items[].place and posts the session', () async {
    final result = await repo.exploreForYou(
      destinationId: 'danang',
      sessionId: 's1',
    );
    expect(result.single.id, 'r1');
    final body = adapter.requests.single.data as Map;
    expect(body['destinationId'], 'danang');
    expect(body['sessionId'], 's1');
    expect(body['query'], isNull);
  });

  test('errors become AppFailure', () async {
    status = 401;
    await expectLater(
      repo.exploreForYou(destinationId: 'danang', sessionId: 's'),
      throwsA(
        isA<AppFailure>().having(
          (f) => f.type,
          'type',
          AppFailureType.unauthorized,
        ),
      ),
    );
    status = 500;
    await expectLater(repo.search(query: 'x'), throwsA(isA<AppFailure>()));
  });
}
