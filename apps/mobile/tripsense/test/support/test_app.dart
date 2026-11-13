import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:trip/app/routes.dart';
import 'package:trip/features/auth/data/auth_repository_impl.dart';
import 'package:trip/l10n/gen/app_localizations.dart';

import 'fake_auth_repository.dart';

/// Hosts [home] at `/` inside a real [GoRouter]; other auth routes are stubs
/// that print their name (and `email` query) so navigation can be asserted.
Widget testApp({required Widget home, FakeAuthRepository? repo}) {
  Widget stub(String name, GoRouterState state) => Scaffold(
    body: Text('$name ${state.uri.queryParameters[Routes.emailParam] ?? ''}'),
  );

  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, _) => home),
      GoRoute(path: Routes.login, builder: (_, s) => stub('LOGIN', s)),
      GoRoute(path: Routes.register, builder: (_, s) => stub('REGISTER', s)),
      GoRoute(path: Routes.verifyEmail, builder: (_, s) => stub('VERIFY', s)),
      GoRoute(
        path: Routes.forgotPassword,
        builder: (_, s) => stub('FORGOT', s),
      ),
      GoRoute(path: Routes.resetPassword, builder: (_, s) => stub('RESET', s)),
    ],
  );

  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(repo ?? FakeAuthRepository()),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en')],
      locale: const Locale('en'),
    ),
  );
}
