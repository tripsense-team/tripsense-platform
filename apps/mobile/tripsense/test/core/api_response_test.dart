import 'package:flutter_test/flutter_test.dart';
import 'package:trip/core/network/api_response.dart';

void main() {
  group('ApiResponse.fromJson', () {
    test('parses the {success, message, data} envelope', () {
      final response = ApiResponse.fromJson<String>(
        {'success': true, 'message': 'ok', 'data': 'payload'},
        (data) => data! as String,
      );

      expect(response.success, isTrue);
      expect(response.message, 'ok');
      expect(response.data, 'payload');
    });

    test('tolerates a missing data field and bad input', () {
      final noData = ApiResponse.fromJson<String>(
        {'success': true, 'message': 'done'},
        (data) => data! as String,
      );
      expect(noData.data, isNull);

      final garbage = ApiResponse.fromJson<String>(
        'not a map',
        (data) => data! as String,
      );
      expect(garbage.success, isFalse);
      expect(garbage.message, isEmpty);
    });
  });

  test('asJsonMap and asJsonList copy loosely typed JSON', () {
    final map = asJsonMap({'a': 1});
    expect(map, {'a': 1});

    final list = asJsonList([
      {'a': 1},
      {'b': 2},
    ]);
    expect(list, [
      {'a': 1},
      {'b': 2},
    ]);
  });
}
