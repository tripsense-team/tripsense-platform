import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/presentation/forgot_password_screen.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/register_screen.dart';
import '../features/auth/presentation/reset_password_screen.dart';
import '../features/auth/presentation/session_controller.dart';
import '../features/auth/presentation/verify_email_screen.dart';
import '../features/onboarding/presentation/onboarding_screen.dart';
import '../features/profile/presentation/profile_screen.dart';
import '../features/shell/coming_soon_page.dart';
import '../features/shell/main_shell.dart';
import '../features/startup/presentation/splash_screen.dart';
import '../l10n/gen/app_localizations.dart';
import 'routes.dart';

/// Pure redirect rule, kept separate so it can be unit-tested.
String? resolveRedirect(SessionState session, String path) {
  final isAuthPath = Routes.publicPaths.contains(path) && path != Routes.splash;
  return switch (session) {
    SessionChecking() => path == Routes.splash ? null : Routes.splash,
    SessionUnauthenticated() => isAuthPath ? null : Routes.login,
    // New users must finish onboarding before reaching the app.
    SessionAuthenticated(:final user) when user.onboardingRequired =>
      path == Routes.onboarding ? null : Routes.onboarding,
    SessionAuthenticated() =>
      Routes.publicPaths.contains(path) || path == Routes.onboarding
          ? Routes.explore
          : null,
  };
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final sessionChanged = ValueNotifier<int>(0);
  ref.listen(sessionControllerProvider, (_, _) => sessionChanged.value++);

  final router = GoRouter(
    initialLocation: Routes.splash,
    refreshListenable: sessionChanged,
    redirect: (context, state) =>
        resolveRedirect(ref.read(sessionControllerProvider), state.uri.path),
    routes: [
      GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen()),
      GoRoute(path: Routes.login, builder: (_, _) => const LoginScreen()),
      GoRoute(path: Routes.register, builder: (_, _) => const RegisterScreen()),
      GoRoute(
        path: Routes.verifyEmail,
        builder: (_, state) => VerifyEmailScreen(
          email: state.uri.queryParameters[Routes.emailParam] ?? '',
        ),
      ),
      GoRoute(
        path: Routes.forgotPassword,
        builder: (_, _) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: Routes.resetPassword,
        builder: (_, state) => ResetPasswordScreen(
          email: state.uri.queryParameters[Routes.emailParam] ?? '',
        ),
      ),
      GoRoute(
        path: Routes.onboarding,
        builder: (_, _) => const OnboardingScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => MainShell(navigationShell: shell),
        branches: [
          _tab(Routes.explore, (l10n) => l10n.navExplore),
          _tab(Routes.trips, (l10n) => l10n.navTrips),
          _tab(Routes.aiPlanner, (l10n) => l10n.navAiPlanner),
          _tab(Routes.community, (l10n) => l10n.navCommunity),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.profile,
                builder: (_, _) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );

  ref.onDispose(() {
    router.dispose();
    sessionChanged.dispose();
  });
  return router;
});

StatefulShellBranch _tab(
  String path,
  String Function(AppLocalizations) title,
) => StatefulShellBranch(
  routes: [
    GoRoute(
      path: path,
      builder: (context, _) =>
          ComingSoonPage(title: title(AppLocalizations.of(context))),
    ),
  ],
);
