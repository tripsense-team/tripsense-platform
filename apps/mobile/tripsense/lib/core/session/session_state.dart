import 'package:flutter_riverpod/flutter_riverpod.dart';

class SessionState {
  const SessionState.unauthenticated() : isAuthenticated = false;

  final bool isAuthenticated;
}

final sessionStateProvider = Provider<SessionState>(
  (ref) => const SessionState.unauthenticated(),
);
