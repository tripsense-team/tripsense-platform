import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/startup/presentation/startup_screen.dart';

const startupRoutePath = '/';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: startupRoutePath,
    routes: [
      GoRoute(
        path: startupRoutePath,
        builder: (context, state) => const StartupScreen(),
      ),
    ],
  );
});
