import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/access_token_store.dart';
import '../../../core/network/api_response.dart';
import '../../../core/network/auth_interceptor.dart';
import '../../../core/network/gateway_client.dart';
import '../../../core/network/token_refresher.dart';
import '../domain/app_user.dart';
import '../domain/auth_repository.dart';

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepositoryImpl(
    dio: ref.watch(gatewayClientProvider),
    store: ref.watch(accessTokenStoreProvider),
    refresher: ref.watch(tokenRefresherProvider),
    cookieJar: ref.watch(cookieJarProvider),
  ),
);

const _publicCall = {skipAuthKey: true};

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl({
    required this._dio,
    required this._store,
    required this._refresher,
    required this._cookieJar,
  });

  final Dio _dio;
  final AccessTokenStore _store;
  final TokenRefresher _refresher;
  final CookieJar _cookieJar;

  Future<void> _post(String path, Map<String, Object?> body) => guardApi(
    () => _dio.post<void>(
      path,
      data: body,
      options: Options(extra: _publicCall),
    ),
  );

  @override
  Future<void> register({required String email, required String password}) =>
      _post('/api/auth/register', {'email': email, 'password': password});

  @override
  Future<void> verifyEmail({required String email, required String code}) =>
      _post('/api/auth/verify-email', {'email': email, 'code': code});

  @override
  Future<void> resendCode({required String email}) =>
      _post('/api/auth/resend-code', {'email': email});

  @override
  Future<void> forgotPassword({required String email}) =>
      _post('/api/auth/forgot-password', {'email': email});

  @override
  Future<void> resetPassword({
    required String email,
    required String code,
    required String newPassword,
  }) => _post('/api/auth/reset-password', {
    'email': email,
    'otp': code,
    'newPassword': newPassword,
  });

  @override
  Future<AppUser> login({required String email, required String password}) =>
      guardApi(() async {
        final response = await _dio.post<Map<String, dynamic>>(
          '/api/auth/login',
          data: {'email': email, 'password': password},
          options: Options(extra: _publicCall),
        );
        final data = asJsonMap(response.data?['data']);
        _store.set(data['accessToken'] as String);
        return _withProfile(AppUser.fromJson(asJsonMap(data['user'])));
      });

  @override
  Future<AppUser?> restoreSession() async {
    final token = await _refresher.refresh();
    if (token == null) return null;
    return guardApi(() async {
      final response = await _dio.get<Map<String, dynamic>>('/api/users/me');
      return _withProfile(AppUser.fromJson(asJsonMap(response.data?['data'])));
    });
  }

  @override
  Future<void> logout() async {
    try {
      await _dio.post<void>(
        '/api/auth/logout',
        options: Options(extra: _publicCall),
      );
    } on DioException {
      // Local state is cleared regardless of network outcome.
    } finally {
      _store.clear();
      await _cookieJar.deleteAll();
    }
  }

  /// Adds display name / avatar / onboarding flag; profile failure is non-fatal.
  Future<AppUser> _withProfile(AppUser user) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/api/users/profile/${user.id}',
      );
      final profile = asJsonMap(response.data?['data']);
      return user.withProfile(
        name: profile['displayName'] as String?,
        avatarUrl: profile['avatarUrl'] as String?,
        onboardingRequired: profile['onboardingRequired'] as bool? ?? false,
      );
    } on DioException {
      return user;
    }
  }
}
