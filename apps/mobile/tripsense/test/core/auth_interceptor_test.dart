import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trip/core/network/access_token_store.dart';
import 'package:trip/core/network/auth_interceptor.dart';
import 'package:trip/core/network/token_refresher.dart';

/// Routes requests to canned responses and counts calls per path.
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.handler);

  final ResponseBody Function(RequestOptions options) handler;
  final calls = <String, int>{};

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls[options.path] = (calls[options.path] ?? 0) + 1;
    await Future<void>.delayed(const Duration(milliseconds: 10));
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(int status, Object body) => ResponseBody.fromString(
  jsonEncode(body),
  status,
  headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  },
);

void main() {
  late AccessTokenStore store;
  late _FakeAdapter apiAdapter;
  late _FakeAdapter refreshAdapter;
  late Dio dio;
  var expired = 0;
  var refreshStatus = 200;

  Dio newClient(_FakeAdapter adapter) =>
      Dio(BaseOptions(baseUrl: 'http://x'))..httpClientAdapter = adapter;

  setUp(() {
    expired = 0;
    refreshStatus = 200;
    store = AccessTokenStore()..set('old');

    refreshAdapter = _FakeAdapter(
      (_) => refreshStatus == 200
          ? _json(200, {
              'data': {'accessToken': 'new'},
            })
          : _json(refreshStatus, {'message': 'expired'}),
    );

    apiAdapter = _FakeAdapter((options) {
      final auth = options.headers['Authorization'];
      return auth == 'Bearer new'
          ? _json(200, {'ok': true})
          : _json(401, {'message': 'unauthorized'});
    });
    dio = newClient(apiAdapter);
    dio.interceptors.add(
      AuthInterceptor(
        dio: dio,
        store: store,
        refresher: TokenRefresher(newClient(refreshAdapter), store),
        onSessionExpired: () => expired++,
      ),
    );
  });

  test('attaches bearer token and retries once after a refresh', () async {
    final response = await dio.get<Map<String, dynamic>>('/api/trips');

    expect(response.data, {'ok': true});
    expect(store.token, 'new');
    expect(apiAdapter.calls['/api/trips'], 2);
    expect(refreshAdapter.calls[refreshPath], 1);
  });

  test('concurrent 401s share a single refresh request', () async {
    await Future.wait([
      dio.get<void>('/api/a'),
      dio.get<void>('/api/b'),
      dio.get<void>('/api/c'),
    ]);

    expect(refreshAdapter.calls[refreshPath], 1);
  });

  test('failed refresh clears the token and signals session expiry', () async {
    refreshStatus = 401;

    await expectLater(
      dio.get<void>('/api/trips'),
      throwsA(isA<DioException>()),
    );

    expect(store.token, isNull);
    expect(expired, 1);
  });

  test('auth endpoints never trigger refresh', () async {
    await expectLater(
      dio.post<void>('/api/auth/login'),
      throwsA(isA<DioException>()),
    );

    expect(refreshAdapter.calls, isEmpty);
    expect(expired, 0);
  });

  test('a malformed refresh response means "no session", not a crash', () async {
    final badRefresher = TokenRefresher(
      newClient(
        _FakeAdapter((_) => _json(200, {'data': 'not-an-object'})),
      ),
      store,
    );

    expect(await badRefresher.refresh(), isNull);
    expect(store.token, isNull);
  });

  test('a refresh finishing after logout is discarded', () async {
    final refresher = TokenRefresher(newClient(refreshAdapter), store);

    final pending = refresher.refresh();
    store.clear(); // user logs out while the refresh is in flight
    final token = await pending;

    expect(token, isNull);
    expect(store.token, isNull);
  });
}
