import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// Dio adapter returning canned JSON; records every request for assertions.
class FakeHttpAdapter implements HttpClientAdapter {
  FakeHttpAdapter(this.handler);

  /// Return `(statusCode, body)` for the request.
  final (int, Object?) Function(RequestOptions options) handler;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final (status, body) = handler(options);
    return ResponseBody.fromString(
      jsonEncode(body ?? <String, Object?>{}),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Dio dioWith(FakeHttpAdapter adapter) =>
    Dio(BaseOptions(baseUrl: 'http://gateway'))..httpClientAdapter = adapter;
