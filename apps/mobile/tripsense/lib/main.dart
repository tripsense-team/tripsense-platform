import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'core/analytics/analytics_service.dart';
import 'core/network/gateway_client.dart';
import 'core/network/secure_cookie_storage.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final cookieJar = PersistCookieJar(storage: SecureCookieStorage());
  final analyticsService = await initializeAnalyticsSafely();

  runApp(
    ProviderScope(
      overrides: [
        cookieJarProvider.overrideWithValue(cookieJar),
        analyticsServiceProvider.overrideWithValue(analyticsService),
      ],
      child: const TripSenseApp(),
    ),
  );
}
