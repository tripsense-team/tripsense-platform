import 'package:flutter_riverpod/flutter_riverpod.dart';

const defaultApiBaseUrl = 'http://10.0.2.2:8080';

class AppConfig {
  const AppConfig({
    this.apiBaseUrl = const String.fromEnvironment(
      'TRIPSENSE_API_BASE_URL',
      defaultValue: defaultApiBaseUrl,
    ),
  });

  final String apiBaseUrl;
}

final appConfigProvider = Provider<AppConfig>((ref) => const AppConfig());
