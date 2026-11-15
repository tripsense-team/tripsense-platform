import 'package:flutter_test/flutter_test.dart';
import 'package:trip/app/app_router.dart';
import 'package:trip/app/routes.dart';
import 'package:trip/features/auth/presentation/session_controller.dart';

import '../support/fake_auth_repository.dart';

void main() {
  test('checking sessions are held on the splash route', () {
    const session = SessionChecking();
    expect(resolveRedirect(session, Routes.splash), isNull);
    expect(resolveRedirect(session, Routes.explore), Routes.splash);
  });

  test('guests may only visit auth routes', () {
    const session = SessionUnauthenticated();
    expect(resolveRedirect(session, Routes.login), isNull);
    expect(resolveRedirect(session, Routes.register), isNull);
    expect(resolveRedirect(session, Routes.trips), Routes.login);
    expect(resolveRedirect(session, Routes.splash), Routes.login);
  });

  test('new users are held on onboarding until it is completed', () {
    final newcomer = travelerUser.withProfile(onboardingRequired: true);
    final session = SessionAuthenticated(newcomer);

    expect(resolveRedirect(session, Routes.explore), Routes.onboarding);
    expect(resolveRedirect(session, Routes.trips), Routes.onboarding);
    expect(resolveRedirect(session, Routes.login), Routes.onboarding);
    expect(resolveRedirect(session, Routes.onboarding), isNull);
  });

  test('finished users cannot reopen the onboarding wizard', () {
    const session = SessionAuthenticated(travelerUser);

    expect(resolveRedirect(session, Routes.onboarding), Routes.explore);
  });

  test('guests cannot reach onboarding', () {
    expect(
      resolveRedirect(const SessionUnauthenticated(), Routes.onboarding),
      Routes.login,
    );
  });

  test('signed-in users are moved off auth routes', () {
    const session = SessionAuthenticated(travelerUser);
    expect(resolveRedirect(session, Routes.login), Routes.explore);
    expect(resolveRedirect(session, Routes.splash), Routes.explore);
    expect(resolveRedirect(session, Routes.trips), isNull);
  });
}
