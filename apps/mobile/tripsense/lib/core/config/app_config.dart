import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Android emulator -> host machine API Gateway (see README for iOS/device).
const defaultApiBaseUrl = 'http://10.0.2.2:8085';

class AppConfig {
  const AppConfig({
    this.apiBaseUrl = const String.fromEnvironment(
      'TRIPSENSE_API_BASE_URL',
      defaultValue: defaultApiBaseUrl,
    ),
  });

  /// Single entry point for all backend traffic. Never point at a service port.
  final String apiBaseUrl;
}

final appConfigProvider = Provider<AppConfig>((ref) => const AppConfig());
