import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import 'access_token_store.dart';
import 'auth_interceptor.dart';
import 'token_refresher.dart';

export 'failure_mapper.dart';

const gatewayConnectTimeout = Duration(seconds: 10);
const gatewayReceiveTimeout = Duration(seconds: 20);

/// Overridden in `main()` with a persistent jar; tests use an in-memory one.
final cookieJarProvider = Provider<CookieJar>(
  (ref) => throw UnimplementedError('cookieJarProvider must be overridden'),
);

/// Counter bumped whenever the refresh token is rejected. The session
/// controller listens to it; this keeps the network layer free of feature code.
class SessionExpiry extends Notifier<int> {
  @override
  int build() => 0;

  void notifyExpired() => state++;
}

final sessionExpiryProvider = NotifierProvider<SessionExpiry, int>(
  SessionExpiry.new,
);

BaseOptions _baseOptions(AppConfig config) => BaseOptions(
  baseUrl: config.apiBaseUrl,
  connectTimeout: gatewayConnectTimeout,
  receiveTimeout: gatewayReceiveTimeout,
  headers: const {'Accept': 'application/json'},
);

/// Plain client (cookies, no auth interceptor) used only to refresh tokens.
final refreshClientProvider = Provider<Dio>((ref) {
  final dio = Dio(_baseOptions(ref.watch(appConfigProvider)));
  dio.interceptors.add(CookieManager(ref.watch(cookieJarProvider)));
  return dio;
});

final tokenRefresherProvider = Provider<TokenRefresher>(
  (ref) => TokenRefresher(
    ref.watch(refreshClientProvider),
    ref.watch(accessTokenStoreProvider),
  ),
);

/// The only HTTP client features may use. All traffic goes through the Gateway.
final gatewayClientProvider = Provider<Dio>((ref) {
  final dio = Dio(_baseOptions(ref.watch(appConfigProvider)));
  dio.interceptors
    ..add(CookieManager(ref.watch(cookieJarProvider)))
    ..add(
      AuthInterceptor(
        dio: dio,
        store: ref.watch(accessTokenStoreProvider),
        refresher: ref.watch(tokenRefresherProvider),
        onSessionExpired: () =>
            ref.read(sessionExpiryProvider.notifier).notifyExpired(),
      ),
    );
  return dio;
});
