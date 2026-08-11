import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trip/app/app.dart';
import 'package:trip/app/app_router.dart';
import 'package:trip/core/config/app_config.dart';
import 'package:trip/core/errors/app_failure.dart';
import 'package:trip/core/network/gateway_client.dart';
import 'package:trip/core/session/session_state.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  testWidgets('renders the TripSense startup shell', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: TripSenseApp()));

    expect(find.text('TripSense'), findsOneWidget);
    expect(find.text('TripSense mobile foundation'), findsOneWidget);
    expect(find.byType(FloatingActionButton), findsNothing);
  });

  test('router starts on the public startup route', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final router = container.read(appRouterProvider);

    expect(router.routeInformationProvider.value.uri.path, startupRoutePath);
  });

  test('app config uses the Android emulator Gateway URL by default', () {
    const config = AppConfig();

    expect(config.apiBaseUrl, defaultApiBaseUrl);
  });

  test('Gateway client applies base URL and timeout configuration', () {
    final container = ProviderContainer(
      overrides: [
        appConfigProvider.overrideWithValue(
          const AppConfig(apiBaseUrl: 'http://localhost:8080'),
        ),
      ],
    );
    addTearDown(container.dispose);

    final client = container.read(gatewayClientProvider);

    expect(client.options.baseUrl, 'http://localhost:8080');
    expect(client.options.connectTimeout, gatewayConnectTimeout);
    expect(client.options.receiveTimeout, gatewayReceiveTimeout);
  });

  test('Dio errors normalize to app failures', () {
    expect(
      normalizeDioFailure(
        DioException(
          requestOptions: RequestOptions(),
          type: DioExceptionType.connectionError,
        ),
      ).type,
      AppFailureType.network,
    );
    expect(
      normalizeDioFailure(
        DioException(
          requestOptions: RequestOptions(),
          type: DioExceptionType.connectionTimeout,
        ),
      ).type,
      AppFailureType.timeout,
    );
    expect(
      normalizeDioFailure(
        DioException(
          requestOptions: RequestOptions(),
          response: Response(statusCode: 401, requestOptions: RequestOptions()),
        ),
      ).type,
      AppFailureType.unauthorized,
    );
    expect(
      normalizeDioFailure(
        DioException(
          requestOptions: RequestOptions(),
          response: Response(statusCode: 403, requestOptions: RequestOptions()),
        ),
      ).type,
      AppFailureType.forbidden,
    );
    expect(
      normalizeDioFailure(
        DioException(
          requestOptions: RequestOptions(),
          response: Response(statusCode: 500, requestOptions: RequestOptions()),
        ),
      ).type,
      AppFailureType.server,
    );
    expect(
      normalizeDioFailure(DioException(requestOptions: RequestOptions())).type,
      AppFailureType.unknown,
    );
  });

  test('session state starts unauthenticated without tokens', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final session = container.read(sessionStateProvider);

    expect(session.isAuthenticated, isFalse);
  });
}
