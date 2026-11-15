import 'package:dio/dio.dart';

import 'access_token_store.dart';
import 'token_refresher.dart';

/// Request option: skip bearer header and 401 auto-refresh (public/auth calls).
const skipAuthKey = 'skipAuth';
const _retriedKey = 'authRetried';

/// Paths that must never trigger the 401 refresh loop (same list as web).
const _authPaths = [
  '/api/auth/login',
  '/api/auth/google',
  '/api/auth/logout',
  '/api/auth/logout-all',
  '/api/auth/refresh',
  '/api/auth/register',
  '/api/auth/verify-email',
  '/api/auth/resend-code',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required this._dio,
    required this._store,
    required this._refresher,
    required this._onSessionExpired,
  });

  final Dio _dio;
  final AccessTokenStore _store;
  final TokenRefresher _refresher;
  final void Function() _onSessionExpired;

  bool _skips(RequestOptions options) =>
      options.extra[skipAuthKey] == true ||
      _authPaths.any(options.path.contains);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final token = _store.token;
    if (token != null && !_skips(options)) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final request = err.requestOptions;
    final isRetryable =
        err.response?.statusCode == 401 &&
        !_skips(request) &&
        request.extra[_retriedKey] != true;
    if (!isRetryable) return handler.next(err);

    final token = await _refresher.refresh();
    if (token == null) {
      _onSessionExpired();
      return handler.next(err);
    }

    try {
      request.extra[_retriedKey] = true;
      request.headers['Authorization'] = 'Bearer $token';
      handler.resolve(await _dio.fetch<dynamic>(request));
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }
}
