import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trip/core/errors/app_failure.dart';
import 'package:trip/core/network/gateway_client.dart';
import 'package:trip/features/auth/data/auth_repository_impl.dart';
import 'package:trip/features/auth/domain/app_user.dart';
import 'package:trip/features/auth/presentation/session_controller.dart';

import '../../support/fake_auth_repository.dart';

ProviderContainer _container(FakeAuthRepository repo) {
  final container = ProviderContainer(
    overrides: [authRepositoryProvider.overrideWithValue(repo)],
  );
  addTearDown(container.dispose);
  return container;
}

Future<void> _settle() => Future<void>.delayed(Duration.zero);

void main() {
  test('starts checking, then guest without a stored session', () async {
    final container = _container(FakeAuthRepository());

    expect(container.read(sessionControllerProvider), isA<SessionChecking>());
    await _settle();
    expect(
      container.read(sessionControllerProvider),
      isA<SessionUnauthenticated>(),
    );
  });

  test('unexpected restore errors never leave the app on the splash', () async {
    for (final error in <Object>[
      StateError('secure storage unavailable'),
      const FormatException('bad payload'),
      const AppFailure(type: AppFailureType.network),
    ]) {
      final container = _container(FakeAuthRepository()..restoreError = error);

      container.read(sessionControllerProvider);
      await _settle();

      expect(
        container.read(sessionControllerProvider),
        isA<SessionUnauthenticated>(),
        reason: '$error',
      );
    }
  });

  test('restores a traveler session', () async {
    final container = _container(FakeAuthRepository(restored: travelerUser));

    container.read(sessionControllerProvider);
    await _settle();

    expect(
      container.read(sessionControllerProvider),
      isA<SessionAuthenticated>(),
    );
  });

  test('login authenticates a traveler', () async {
    final container = _container(FakeAuthRepository());
    await _settle();

    await container
        .read(sessionControllerProvider.notifier)
        .login(email: 'a@b.com', password: 'secret1');

    expect(
      container.read(sessionControllerProvider),
      isA<SessionAuthenticated>(),
    );
  });

  test('admin accounts are signed out and flagged as web-only', () async {
    const admin = AppUser(
      id: 'a1',
      email: 'admin@b.com',
      role: UserRole.admin,
      hasPassword: true,
    );
    final repo = FakeAuthRepository(loginResult: admin);
    final container = _container(repo);
    await _settle();

    await container
        .read(sessionControllerProvider.notifier)
        .login(email: 'admin@b.com', password: 'secret1');

    final state = container.read(sessionControllerProvider);
    expect(state, isA<SessionUnauthenticated>());
    expect((state as SessionUnauthenticated).roleBlocked, isTrue);
    expect(repo.logoutCalls, 1);
  });

  test('login failure stays unauthenticated and rethrows', () async {
    final repo = FakeAuthRepository()
      ..loginError = const AppFailure(type: AppFailureType.unauthorized);
    final container = _container(repo);
    await _settle();

    await expectLater(
      container
          .read(sessionControllerProvider.notifier)
          .login(email: 'a@b.com', password: 'bad'),
      throwsA(isA<AppFailure>()),
    );
    expect(
      container.read(sessionControllerProvider),
      isA<SessionUnauthenticated>(),
    );
  });

  test('refresh-token expiry signs the user out', () async {
    final container = _container(FakeAuthRepository(restored: travelerUser));
    container.read(sessionControllerProvider);
    await _settle();

    container.read(sessionExpiryProvider.notifier).notifyExpired();

    expect(
      container.read(sessionControllerProvider),
      isA<SessionUnauthenticated>(),
    );
  });

  test('logout clears the session and calls the repository', () async {
    final repo = FakeAuthRepository(restored: travelerUser);
    final container = _container(repo);
    container.read(sessionControllerProvider);
    await _settle();

    await container.read(sessionControllerProvider.notifier).logout();

    expect(
      container.read(sessionControllerProvider),
      isA<SessionUnauthenticated>(),
    );
    expect(repo.logoutCalls, 1);
  });
}
