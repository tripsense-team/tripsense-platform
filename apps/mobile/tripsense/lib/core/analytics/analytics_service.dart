import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Abstraction over GA4 / Firebase Analytics so callers and tests stay decoupled
/// from Firebase platform channels and unconfigured dev environments never crash.
abstract interface class AnalyticsBackend {
  NavigatorObserver? get navigatorObserver;
  Future<void> logEvent({
    required String name,
    Map<String, Object>? parameters,
  });
}

class FirebaseAnalyticsBackend implements AnalyticsBackend {
  FirebaseAnalyticsBackend(this._analytics);

  final FirebaseAnalytics _analytics;

  @override
  NavigatorObserver? get navigatorObserver =>
      FirebaseAnalyticsObserver(analytics: _analytics);

  @override
  Future<void> logEvent({
    required String name,
    Map<String, Object>? parameters,
  }) =>
      _analytics.logEvent(name: name, parameters: parameters);
}

class NoOpAnalyticsBackend implements AnalyticsBackend {
  const NoOpAnalyticsBackend();

  @override
  NavigatorObserver? get navigatorObserver => null;

  @override
  Future<void> logEvent({
    required String name,
    Map<String, Object>? parameters,
  }) async {}
}

/// Standardized non-PII GA4 event tracker for TripSense Mobile.
class AnalyticsService {
  AnalyticsService({AnalyticsBackend? backend})
      : _backend = backend ?? const NoOpAnalyticsBackend();

  final AnalyticsBackend _backend;

  NavigatorObserver? get navigatorObserver => _backend.navigatorObserver;

  Future<void> logEvent(
    String name, {
    Map<String, Object>? parameters,
  }) async {
    try {
      await _backend.logEvent(name: name, parameters: parameters);
    } catch (error) {
      if (kDebugMode) {
        debugPrint('Analytics logEvent($name) skipped: $error');
      }
    }
  }

  Future<void> logLogin({required String method}) =>
      logEvent('login', parameters: {'method': method});

  Future<void> logSignUp({required String method}) =>
      logEvent('sign_up', parameters: {'method': method});

  Future<void> logViewPlace({
    required String placeId,
    String? category,
    String? city,
  }) =>
      logEvent(
        'view_place',
        parameters: {
          'place_id': placeId,
          if (category != null && category.isNotEmpty) 'category': category,
          if (city != null && city.isNotEmpty) 'city': city,
        },
      );

  Future<void> logCreateTrip({required String source}) =>
      logEvent('create_trip', parameters: {'source': source});
}

/// Safely initializes Firebase if native platform configuration is present.
/// Returns a ready [AnalyticsService], falling back to a no-op backend in
/// unconfigured local dev or widget tests.
Future<AnalyticsService> initializeAnalyticsSafely() async {
  try {
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp();
    }
    return AnalyticsService(
      backend: FirebaseAnalyticsBackend(FirebaseAnalytics.instance),
    );
  } catch (error) {
    if (kDebugMode) {
      debugPrint(
        'Firebase Analytics disabled (missing native config or unsupported platform): $error',
      );
    }
    return AnalyticsService();
  }
}

final analyticsServiceProvider = Provider<AnalyticsService>(
  (ref) => AnalyticsService(),
);

