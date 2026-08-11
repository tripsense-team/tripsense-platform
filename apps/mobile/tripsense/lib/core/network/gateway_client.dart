import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../errors/app_failure.dart';

const gatewayConnectTimeout = Duration(seconds: 10);
const gatewayReceiveTimeout = Duration(seconds: 20);

final gatewayClientProvider = Provider<Dio>((ref) {
  final config = ref.watch(appConfigProvider);

  return Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: gatewayConnectTimeout,
      receiveTimeout: gatewayReceiveTimeout,
    ),
  );
});

AppFailure normalizeDioFailure(DioException error) {
  if (error.type == DioExceptionType.connectionTimeout ||
      error.type == DioExceptionType.sendTimeout ||
      error.type == DioExceptionType.receiveTimeout) {
    return AppFailure(
      type: AppFailureType.timeout,
      statusCode: error.response?.statusCode,
      message: error.message,
    );
  }

  if (error.type == DioExceptionType.connectionError) {
    return AppFailure(
      type: AppFailureType.network,
      statusCode: error.response?.statusCode,
      message: error.message,
    );
  }

  final statusCode = error.response?.statusCode;
  final failureType = switch (statusCode) {
    401 => AppFailureType.unauthorized,
    403 => AppFailureType.forbidden,
    final int code when code >= 500 => AppFailureType.server,
    _ => AppFailureType.unknown,
  };

  return AppFailure(
    type: failureType,
    statusCode: statusCode,
    message: error.message,
  );
}
