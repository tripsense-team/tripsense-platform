enum AppFailureType {
  network,
  timeout,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validation,
  rateLimited,
  server,
  unknown,
}

/// Sanitized, UI-safe failure. Never carries raw server/SQL/token text.
class AppFailure implements Exception {
  const AppFailure({
    required this.type,
    this.statusCode,
    this.serverMessage,
    this.incidentId,
  });

  final AppFailureType type;
  final int? statusCode;

  /// Backend message that already passed [sanitizeServerMessage]; may be null.
  final String? serverMessage;

  /// Present for server/unknown failures so users can report an issue.
  final String? incidentId;

  @override
  String toString() => 'AppFailure($type, status: $statusCode)';
}
