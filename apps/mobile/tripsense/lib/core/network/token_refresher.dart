import 'package:dio/dio.dart';

import 'access_token_store.dart';

const refreshPath = '/api/auth/refresh';

/// Exchanges the refresh cookie for a new access token.
///
/// Single-flight: concurrent callers share one request. The result is dropped
/// if the user logged out (token store version changed) while it was in flight.
class TokenRefresher {
  TokenRefresher(this._dio, this._store);

  /// Plain Dio (no auth interceptor) sharing the app cookie jar.
  final Dio _dio;
  final AccessTokenStore _store;
  Future<String?>? _inFlight;

  Future<String?> refresh() => _inFlight ??= _run().whenComplete(() {
    _inFlight = null;
  });

  Future<String?> _run() async {
    final startVersion = _store.version;
    try {
      final response = await _dio.post<Map<String, dynamic>>(refreshPath);
      final data = response.data?['data'];
      final token = data is Map ? data['accessToken'] as String? : null;
      if (token == null || token.isEmpty) {
        _store.clear();
        return null;
      }
      if (_store.version != startVersion) {
        return null; // logged out / re-logged in while refreshing: discard
      }
      _store.set(token);
      return token;
    } catch (_) {
      // Network, storage or malformed-response failures all mean "no session".
      _store.clear();
      return null;
    }
  }
}
