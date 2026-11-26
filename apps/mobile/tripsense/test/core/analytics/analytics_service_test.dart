import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trip/core/analytics/analytics_service.dart';

class _RecordingBackend implements AnalyticsBackend {
  final List<(String, Map<String, Object>?)> events = [];
  bool shouldThrow = false;

  @override
  NavigatorObserver? get navigatorObserver => null;

  @override
  Future<void> logEvent({
    required String name,
    Map<String, Object>? parameters,
  }) async {
    if (shouldThrow) {
      throw StateError('analytics unavailable');
    }
    events.add((name, parameters));
  }
}

void main() {
  test('NoOp backend never throws and has no navigatorObserver', () async {
    final service = AnalyticsService();
    expect(service.navigatorObserver, isNull);
    await service.logLogin(method: 'email');
    await service.logViewPlace(placeId: 'p1', category: 'cafe', city: 'Da Nang');
  });

  test('dispatches standardized non-PII events to backend', () async {
    final backend = _RecordingBackend();
    final service = AnalyticsService(backend: backend);

    await service.logLogin(method: 'email');
    await service.logSignUp(method: 'email');
    await service.logViewPlace(
      placeId: 'place_1',
      category: 'restaurant',
      city: 'Da Nang',
    );
    await service.logCreateTrip(source: 'manual');

    expect(backend.events, [
      ('login', {'method': 'email'}),
      ('sign_up', {'method': 'email'}),
      (
        'view_place',
        {'place_id': 'place_1', 'category': 'restaurant', 'city': 'Da Nang'},
      ),
      ('create_trip', {'source': 'manual'}),
    ]);
  });

  test('swallows backend errors so user flows never break', () async {
    final backend = _RecordingBackend()..shouldThrow = true;
    final service = AnalyticsService(backend: backend);

    await expectLater(service.logLogin(method: 'google'), completes);
  });
}

