import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trip/core/network/secure_cookie_storage.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  test('writes, reads and deletes cookies under a dedicated prefix', () async {
    final storage = SecureCookieStorage();
    await storage.init(true, false);

    await storage.write('host', 'refreshToken=abc');
    expect(await storage.read('host'), 'refreshToken=abc');

    // Stored under the prefix so cookies never collide with other secrets.
    final raw = await const FlutterSecureStorage().readAll();
    expect(raw.keys, contains('cookie.host'));

    await storage.delete('host');
    expect(await storage.read('host'), isNull);
  });

  test('deleteAll removes every given key', () async {
    final storage = SecureCookieStorage();
    await storage.write('a', '1');
    await storage.write('b', '2');

    await storage.deleteAll(['a', 'b']);

    expect(await storage.read('a'), isNull);
    expect(await storage.read('b'), isNull);
  });
}
