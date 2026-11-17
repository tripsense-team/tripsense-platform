import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trip/core/errors/app_failure.dart';
import 'package:trip/core/errors/error_sanitizer.dart';
import 'package:trip/core/network/failure_mapper.dart';

DioException _http(int status, [Object? body]) {
  final options = RequestOptions();
  return DioException(
    requestOptions: options,
    response: Response<Object?>(
      statusCode: status,
      data: body,
      requestOptions: options,
    ),
  );
}

void main() {
  group('sanitizeServerMessage', () {
    test('keeps short friendly messages', () {
      expect(
        sanitizeServerMessage('Email already exists'),
        'Email already exists',
      );
    });

    test('drops technical or oversized messages', () {
      expect(
        sanitizeServerMessage('org.springframework.dao.DataAccess'),
        isNull,
      );
      expect(sanitizeServerMessage('JDBC connection failed'), isNull);
      expect(sanitizeServerMessage('Bearer abcdefghijklmnop'), isNull);
      expect(sanitizeServerMessage('x' * 500), isNull);
      expect(sanitizeServerMessage('  '), isNull);
    });
  });

  group('normalizeDioFailure', () {
    test('maps transport errors', () {
      final cases = {
        DioExceptionType.connectionTimeout: AppFailureType.timeout,
        DioExceptionType.receiveTimeout: AppFailureType.timeout,
        DioExceptionType.connectionError: AppFailureType.network,
      };
      for (final entry in cases.entries) {
        final failure = normalizeDioFailure(
          DioException(requestOptions: RequestOptions(), type: entry.key),
        );
        expect(failure.type, entry.value);
      }
    });

    test('maps HTTP status codes', () {
      expect(normalizeDioFailure(_http(401)).type, AppFailureType.unauthorized);
      expect(normalizeDioFailure(_http(403)).type, AppFailureType.forbidden);
      expect(normalizeDioFailure(_http(404)).type, AppFailureType.notFound);
      expect(normalizeDioFailure(_http(409)).type, AppFailureType.conflict);
      expect(normalizeDioFailure(_http(429)).type, AppFailureType.rateLimited);
      expect(normalizeDioFailure(_http(400)).type, AppFailureType.validation);
    });

    test('server errors never expose the body and carry an incident id', () {
      final failure = normalizeDioFailure(
        _http(500, {'message': 'JDBC exception at SELECT * FROM users'}),
      );
      expect(failure.type, AppFailureType.server);
      expect(failure.serverMessage, isNull);
      expect(failure.incidentId, startsWith('ERR-'));
    });

    test('client errors expose only sanitized messages', () {
      final safe = normalizeDioFailure(
        _http(409, {'message': 'Email already registered'}),
      );
      expect(safe.serverMessage, 'Email already registered');

      final leaky = normalizeDioFailure(
        _http(400, {'message': 'could not execute statement; SQL [insert]'}),
      );
      expect(leaky.serverMessage, isNull);
    });
  });
}
