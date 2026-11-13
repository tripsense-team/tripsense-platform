import 'package:dio/dio.dart';

import '../errors/app_failure.dart';
import '../errors/error_sanitizer.dart';

/// Converts any Dio error to a sanitized [AppFailure].
AppFailure normalizeDioFailure(DioException error) {
  switch (error.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
      return const AppFailure(type: AppFailureType.timeout);
    case DioExceptionType.connectionError:
      return const AppFailure(type: AppFailureType.network);
    default:
      break;
  }

  final statusCode = error.response?.statusCode;
  final type = switch (statusCode) {
    400 || 422 => AppFailureType.validation,
    401 => AppFailureType.unauthorized,
    403 => AppFailureType.forbidden,
    404 => AppFailureType.notFound,
    409 => AppFailureType.conflict,
    429 => AppFailureType.rateLimited,
    final int code when code >= 500 => AppFailureType.server,
    _ => AppFailureType.unknown,
  };

  final isClientError = statusCode != null && statusCode < 500;
  return AppFailure(
    type: type,
    statusCode: statusCode,
    serverMessage: isClientError ? sanitizeServerMessage(_messageOf(error)) : null,
    incidentId:
        type == AppFailureType.server || type == AppFailureType.unknown
        ? createIncidentReference()
        : null,
  );
}

String? _messageOf(DioException error) {
  final data = error.response?.data;
  if (data is Map && data['message'] is String) {
    return data['message'] as String;
  }
  return null;
}

/// Runs [call] and rethrows any [DioException] as [AppFailure].
Future<T> guardApi<T>(Future<T> Function() call) async {
  try {
    return await call();
  } on DioException catch (error) {
    throw normalizeDioFailure(error);
  } on TypeError {
    throw AppFailure(
      type: AppFailureType.unknown,
      incidentId: createIncidentReference(),
    );
  }
}
