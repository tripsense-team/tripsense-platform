import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/network/gateway_client.dart';
import '../data/auth_repository_impl.dart';
import '../domain/app_user.dart';

/// Upper bound for restoring a session before showing the login screen.
const restoreTimeout = Duration(seconds: 30);

sealed class SessionState {
  const SessionState();
}

/// App just started; restoring the session from the refresh cookie.
final class SessionChecking extends SessionState {
  const SessionChecking();
}

final class SessionAuthenticated extends SessionState {
  const SessionAuthenticated(this.user);
  final AppUser user;
}

final class SessionUnauthenticated extends SessionState {
  const SessionUnauthenticated({this.roleBlocked = false});

  /// Signed in with an admin/moderator/partner account (web-only roles).
  final bool roleBlocked;
}

final sessionControllerProvider =
    NotifierProvider<SessionController, SessionState>(SessionController.new);

class SessionController extends Notifier<SessionState> {
  @override
  SessionState build() {
    ref.listen(sessionExpiryProvider, (_, _) => _expire());
    unawaited(_restore());
    return const SessionChecking();
  }

  /// Never leaves the app on the splash: any failure (network, storage,
  /// parsing) or a stalled request ends in the signed-out state.
  Future<void> _restore() async {
    try {
      final user = await ref
          .read(authRepositoryProvider)
          .restoreSession()
          .timeout(restoreTimeout);
      state = user == null
          ? const SessionUnauthenticated()
          : await _accept(user);
    } catch (_) {
      state = const SessionUnauthenticated();
    }
  }

  /// Throws [AppFailure] on bad credentials / network problems.
  Future<void> login({required String email, required String password}) async {
    final user = await ref
        .read(authRepositoryProvider)
        .login(email: email.trim(), password: password);
    state = await _accept(user);
  }

  Future<void> logout() async {
    state = const SessionUnauthenticated();
    await ref.read(authRepositoryProvider).logout();
  }

  /// Applies the traveler-only rule; blocked roles are signed out again.
  Future<SessionState> _accept(AppUser user) async {
    if (user.isTraveler) return SessionAuthenticated(user);
    await ref.read(authRepositoryProvider).logout();
    return const SessionUnauthenticated(roleBlocked: true);
  }

  void _expire() {
    if (state is SessionAuthenticated) {
      state = const SessionUnauthenticated();
    }
  }
}
