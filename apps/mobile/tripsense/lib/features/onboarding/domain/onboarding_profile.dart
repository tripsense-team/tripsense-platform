/// Server-side onboarding document (`/api/context/onboarding`).
class OnboardingProfile {
  const OnboardingProfile({
    required this.version,
    required this.completed,
    this.selections = const {},
    this.visited = const [],
    this.wantToVisit = const [],
    this.attributes = const {},
    this.freeText = '',
  });

  factory OnboardingProfile.fromJson(Map<String, dynamic> json) {
    List<String> strings(Object? value) =>
        value is List ? [for (final item in value) item.toString()] : const [];

    final rawSelections = json['selections'];
    final rawPlaces = json['places'];
    final rawAttributes = json['attributes'];

    return OnboardingProfile(
      version: (json['version'] as num?)?.toInt() ?? 0,
      completed: json['status'] == 'COMPLETED',
      selections: rawSelections is Map
          ? {
              for (final entry in rawSelections.entries)
                entry.key.toString(): strings(entry.value),
            }
          : const {},
      visited: rawPlaces is Map ? strings(rawPlaces['VISITED']) : const [],
      wantToVisit: rawPlaces is Map
          ? strings(rawPlaces['WANT_TO_VISIT'])
          : const [],
      attributes: rawAttributes is Map
          ? {
              for (final entry in rawAttributes.entries)
                entry.key.toString(): entry.value.toString(),
            }
          : const {},
      freeText: json['freeText'] as String? ?? '',
    );
  }

  final int version;
  final bool completed;
  final Map<String, List<String>> selections;
  final List<String> visited;
  final List<String> wantToVisit;
  final Map<String, String> attributes;
  final String freeText;
}

/// Body of `PUT /api/context/onboarding`.
class OnboardingSaveRequest {
  const OnboardingSaveRequest({
    required this.version,
    required this.selections,
    required this.visited,
    required this.wantToVisit,
    required this.attributes,
    this.freeText,
  });

  final int version;
  final Map<String, List<String>> selections;
  final List<String> visited;
  final List<String> wantToVisit;
  final Map<String, String> attributes;
  final String? freeText;

  Map<String, Object?> toJson() => {
    'version': version,
    'selections': selections,
    'places': {'VISITED': visited, 'WANT_TO_VISIT': wantToVisit},
    'attributes': attributes,
    'freeText': freeText,
  };

  OnboardingSaveRequest withVersion(int newVersion) => OnboardingSaveRequest(
    version: newVersion,
    selections: selections,
    visited: visited,
    wantToVisit: wantToVisit,
    attributes: attributes,
    freeText: freeText,
  );
}
