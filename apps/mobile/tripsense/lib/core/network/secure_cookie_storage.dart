import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists cookies (incl. the HttpOnly refresh token) in Keychain/Keystore
/// instead of plain files.
class SecureCookieStorage extends Storage {
  SecureCookieStorage([FlutterSecureStorage? store])
    : _store = store ?? const FlutterSecureStorage();

  static const _prefix = 'cookie.';
  final FlutterSecureStorage _store;

  @override
  Future<void> init(bool persistSession, bool ignoreExpires) async {}

  @override
  Future<String?> read(String key) => _store.read(key: '$_prefix$key');

  @override
  Future<void> write(String key, String value) =>
      _store.write(key: '$_prefix$key', value: value);

  @override
  Future<void> delete(String key) => _store.delete(key: '$_prefix$key');

  @override
  Future<void> deleteAll(List<String> keys) async {
    for (final key in keys) {
      await delete(key);
    }
  }
}
