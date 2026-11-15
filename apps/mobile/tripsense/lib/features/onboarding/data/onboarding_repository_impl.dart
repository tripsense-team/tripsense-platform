import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_response.dart';
import '../../../core/network/gateway_client.dart';
import '../domain/onboarding_profile.dart';
import '../domain/onboarding_repository.dart';

const _onboardingPath = '/api/context/onboarding';

final onboardingRepositoryProvider = Provider<OnboardingRepository>(
  (ref) => OnboardingRepositoryImpl(ref.watch(gatewayClientProvider)),
);

class OnboardingRepositoryImpl implements OnboardingRepository {
  OnboardingRepositoryImpl(this._dio);

  final Dio _dio;

  // context-service returns the document itself (no {success,data} envelope).
  OnboardingProfile _parse(Response<Map<String, dynamic>> response) =>
      OnboardingProfile.fromJson(asJsonMap(response.data));

  @override
  Future<OnboardingProfile> load() => guardApi(() async {
    try {
      return _parse(await _dio.get<Map<String, dynamic>>(_onboardingPath));
    } on DioException catch (error) {
      if (error.response?.statusCode != 404) rethrow;
      // Not started yet: create the in-progress document.
      return _parse(
        await _dio.post<Map<String, dynamic>>('$_onboardingPath/start'),
      );
    }
  });

  @override
  Future<OnboardingProfile> save(OnboardingSaveRequest request) =>
      guardApi(() async {
        return _parse(
          await _dio.put<Map<String, dynamic>>(
            _onboardingPath,
            data: request.toJson(),
          ),
        );
      });

  @override
  Future<OnboardingProfile> complete(int version) => guardApi(() async {
    return _parse(
      await _dio.post<Map<String, dynamic>>(
        '$_onboardingPath/complete',
        data: {'version': version},
      ),
    );
  });

  @override
  Future<void> markProfileComplete() =>
      guardApi(() => _dio.post<void>('/api/users/profile/onboarding-complete'));

  @override
  Future<void> updateDisplayName(String name) => guardApi(
    () => _dio.put<void>('/api/users/profile', data: {'displayName': name}),
  );
}
