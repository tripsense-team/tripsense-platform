import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Android emulator -> host machine API Gateway (see README for iOS/device).
const defaultApiBaseUrl = 'http://10.0.2.2:8085';

class AppConfig {
  const AppConfig({
    this.apiBaseUrl = const String.fromEnvironment(
      'TRIPSENSE_API_BASE_URL',
      defaultValue: defaultApiBaseUrl,
    ),
    this.mapvinaApiKey = const String.fromEnvironment('MAPVINA_API_KEY'),
  });

  /// Single entry point for all backend traffic. Never point at a service port.
  final String apiBaseUrl;

  /// MapVina tile key, injected at build time (`--dart-define-from-file`),
  /// never committed. Same key family the web uses (NEXT_PUBLIC_MAPVINA_API_KEY).
  final String mapvinaApiKey;

  /// MapVina vector style (as on the web), or null when no key is configured
  /// (the map then falls back to open raster tiles).
  String? get mapStyleUrl => mapvinaApiKey.isEmpty
      ? null
      : 'https://maps.mapvina.com/styles/v2/streets.json'
            '?key=${Uri.encodeQueryComponent(mapvinaApiKey)}';
}

final appConfigProvider = Provider<AppConfig>((ref) => const AppConfig());
