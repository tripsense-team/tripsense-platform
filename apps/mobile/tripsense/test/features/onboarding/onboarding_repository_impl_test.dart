import 'package:flutter_test/flutter_test.dart';
import 'package:trip/core/errors/app_failure.dart';
import 'package:trip/features/onboarding/data/onboarding_repository_impl.dart';
import 'package:trip/features/onboarding/domain/onboarding_profile.dart';

import '../../support/fake_http_adapter.dart';

const _doc = {
  'version': 2,
  'status': 'IN_PROGRESS',
  'selections': {
    'TRAVEL_PARTY': ['SOLO'],
  },
  'places': {'VISITED': <String>[], 'WANT_TO_VISIT': <String>[]},
};

void main() {
  late FakeHttpAdapter adapter;
  late OnboardingRepositoryImpl repo;
  var getStatus = 200;
  var saveStatus = 200;

  setUp(() {
    getStatus = 200;
    saveStatus = 200;
    adapter = FakeHttpAdapter((o) {
      final key = '${o.method} ${o.path}';
      return switch (key) {
        'GET /api/context/onboarding' =>
          getStatus == 200
              ? (200, _doc)
              : (getStatus, {'message': 'Onboarding has not started'}),
        'POST /api/context/onboarding/start' => (200, {..._doc, 'version': 0}),
        'PUT /api/context/onboarding' =>
          saveStatus == 200
              ? (200, {..._doc, 'version': 3})
              : (saveStatus, {'message': 'changed by another request'}),
        'POST /api/context/onboarding/complete' => (
          200,
          {..._doc, 'status': 'COMPLETED', 'version': 4},
        ),
        _ => (200, {'success': true}),
      };
    });
    repo = OnboardingRepositoryImpl(dioWith(adapter));
  });

  test('load returns the saved profile without envelope unwrapping', () async {
    final profile = await repo.load();

    expect(profile.version, 2);
    expect(profile.completed, isFalse);
    expect(profile.selections['TRAVEL_PARTY'], ['SOLO']);
    expect(adapter.requests.map((r) => r.path), ['/api/context/onboarding']);
  });

  test('load starts onboarding when none exists (404)', () async {
    getStatus = 404;

    final profile = await repo.load();

    expect(profile.version, 0);
    expect(adapter.requests.map((r) => '${r.method} ${r.path}'), [
      'GET /api/context/onboarding',
      'POST /api/context/onboarding/start',
    ]);
  });

  test('load surfaces other failures as AppFailure', () async {
    getStatus = 500;

    await expectLater(
      repo.load(),
      throwsA(
        isA<AppFailure>().having((f) => f.type, 'type', AppFailureType.server),
      ),
    );
  });

  test('save PUTs the full document including places and attributes', () async {
    final saved = await repo.save(
      const OnboardingSaveRequest(
        version: 2,
        selections: {
          'TRAVEL_PARTY': ['SOLO'],
        },
        visited: ['da-nang'],
        wantToVisit: [],
        attributes: {'HOME_CITY': '{}'},
        freeText: 'hi',
      ),
    );

    expect(saved.version, 3);
    final body = adapter.requests.single.data as Map;
    expect(body['version'], 2);
    expect(body['places'], {
      'VISITED': ['da-nang'],
      'WANT_TO_VISIT': <String>[],
    });
    expect(body['freeText'], 'hi');
  });

  test('save maps a version conflict to a conflict failure', () async {
    saveStatus = 409;

    await expectLater(
      repo.save(
        const OnboardingSaveRequest(
          version: 1,
          selections: {},
          visited: [],
          wantToVisit: [],
          attributes: {},
        ),
      ),
      throwsA(
        isA<AppFailure>().having(
          (f) => f.type,
          'type',
          AppFailureType.conflict,
        ),
      ),
    );
  });

  test(
    'complete posts the version and returns the completed profile',
    () async {
      final profile = await repo.complete(3);

      expect(profile.completed, isTrue);
      expect(adapter.requests.single.data, {'version': 3});
    },
  );

  test('profile endpoints go to user-service paths', () async {
    await repo.markProfileComplete();
    await repo.updateDisplayName('Alex');

    expect(adapter.requests[0].path, '/api/users/profile/onboarding-complete');
    expect(adapter.requests[1].path, '/api/users/profile');
    expect(adapter.requests[1].data, {'displayName': 'Alex'});
  });
}
