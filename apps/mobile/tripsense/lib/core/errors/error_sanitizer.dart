import 'dart:math';

/// Mirrors the web zero-leak policy (docs/ERROR_HANDLING_AND_LOGGING_STANDARDS.md):
/// server messages that look technical are never shown to the user.
final _sensitivePatterns = <RegExp>[
  RegExp(r'jdbc', caseSensitive: false),
  RegExp(r'\bsql\b', caseSensitive: false),
  RegExp(r'hibernate', caseSensitive: false),
  RegExp(r'psqlexception|sqlexception|dataaccessexception', caseSensitive: false),
  RegExp(r'constraintviolation|violates\s+foreign\s+key|duplicate\s+key', caseSensitive: false),
  RegExp(r'(column|relation|table)\s+.*does\s+not\s+exist', caseSensitive: false),
  RegExp(r'\bselect\b.*\bfrom\b|\binsert\s+into\b|\bdelete\b.*\bfrom\b', caseSensitive: false),
  RegExp(r'org\.springframework|nullpointerexception|classnotfound', caseSensitive: false),
  RegExp(r'stacktrace|nested\s+exception|\.java:\d+', caseSensitive: false),
  RegExp(r'internal\s+server\s+error|bad\s+gateway|service\s+unavailable|gateway\s+timeout', caseSensitive: false),
  RegExp(r'bearer\s+[a-z0-9._-]{10,}', caseSensitive: false),
];

const _maxSafeMessageLength = 200;

/// Returns [raw] only when it is short and free of technical detail.
String? sanitizeServerMessage(String? raw) {
  final message = raw?.trim();
  if (message == null || message.isEmpty || message.length > _maxSafeMessageLength) {
    return null;
  }
  if (_sensitivePatterns.any((pattern) => pattern.hasMatch(message))) {
    return null;
  }
  return message;
}

const _incidentAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/// Short reference a user can quote to support without exposing internals.
String createIncidentReference([Random? random]) {
  final rng = random ?? Random.secure();
  final code = List.generate(
    5,
    (_) => _incidentAlphabet[rng.nextInt(_incidentAlphabet.length)],
  ).join();
  return 'ERR-$code';
}
