import '../../l10n/gen/app_localizations.dart';
import '../errors/app_failure.dart';

/// Localized, user-safe text for [failure]. [unauthorized] lets login screens
/// say "wrong credentials" instead of "session expired".
String failureMessage(
  AppLocalizations l10n,
  AppFailure failure, {
  String? unauthorized,
}) {
  final base = switch (failure.type) {
    AppFailureType.network => l10n.errNetwork,
    AppFailureType.timeout => l10n.errTimeout,
    AppFailureType.unauthorized => unauthorized ?? l10n.errUnauthorized,
    AppFailureType.forbidden => l10n.errForbidden,
    AppFailureType.notFound => l10n.errNotFound,
    AppFailureType.conflict => failure.serverMessage ?? l10n.errConflict,
    AppFailureType.validation => failure.serverMessage ?? l10n.errValidation,
    AppFailureType.rateLimited => l10n.errRateLimited,
    AppFailureType.server => l10n.errServer,
    AppFailureType.unknown => l10n.errUnknown,
  };
  final incident = failure.incidentId;
  return incident == null ? base : '$base\n${l10n.errIncident(incident)}';
}
