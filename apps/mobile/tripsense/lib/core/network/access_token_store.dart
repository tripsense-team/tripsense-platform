import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Holds the short-lived access token in RAM only (never written to disk).
///
/// [version] bumps on every change so an in-flight refresh can detect that the
/// user logged out meanwhile and discard its result.
class AccessTokenStore {
  String? _token;
  int _version = 0;

  String? get token => _token;
  int get version => _version;

  void set(String token) {
    _token = token;
    _version++;
  }

  void clear() {
    _token = null;
    _version++;
  }
}

final accessTokenStoreProvider = Provider<AccessTokenStore>(
  (ref) => AccessTokenStore(),
);
