import 'dart:convert';

import 'onboarding_catalog.dart';
import 'onboarding_profile.dart';

final _optionCode = RegExp(r'^[A-Z0-9_\-]{1,80}$');
final _placeRef = RegExp(r'^[A-Za-z0-9_:\-]{1,160}$');
final _budgetDigits = RegExp(r'^[1-9][0-9]{0,9}$');

const _homeCityKey = 'HOME_CITY';
const _customLabelsKey = 'CUSTOM_PREFERENCE_LABELS';

/// Everything the user has entered so far. Immutable; every edit returns a copy.
class OnboardingDraft {
  const OnboardingDraft({
    this.name = '',
    this.homeCity = '',
    this.visited = const [],
    this.wantToVisit = const [],
    this.selections = const {},
    this.dailyBudget = '',
    this.freeText = '',
    this.customLabels = const {},
    this.baseAttributes = const {},
  });

  /// Rebuilds the draft from a saved (in-progress) server profile.
  factory OnboardingDraft.fromProfile(
    OnboardingProfile profile, {
    String name = '',
  }) {
    var homeCity = '';
    final rawHome = profile.attributes[_homeCityKey];
    if (rawHome != null) {
      try {
        final parsed = jsonDecode(rawHome);
        homeCity = parsed is Map ? (parsed['name'] as String? ?? '') : rawHome;
      } on FormatException {
        homeCity = rawHome;
      }
    }

    var customLabels = const <String, String>{};
    final rawLabels = profile.attributes[_customLabelsKey];
    if (rawLabels != null) {
      try {
        final parsed = jsonDecode(rawLabels);
        if (parsed is Map) {
          customLabels = {
            for (final entry in parsed.entries)
              entry.key.toString(): entry.value.toString(),
          };
        }
      } on FormatException {
        // Ignore malformed labels; they are cosmetic.
      }
    }

    final budget = profile.selections[Dimension.dailyBudgetVnd];
    return OnboardingDraft(
      name: name,
      homeCity: homeCity,
      visited: profile.visited,
      wantToVisit: profile.wantToVisit,
      selections: {
        for (final entry in profile.selections.entries)
          if (entry.key != Dimension.dailyBudgetVnd) entry.key: entry.value,
      },
      dailyBudget: (budget != null && budget.isNotEmpty) ? budget.first : '',
      freeText: profile.freeText,
      customLabels: customLabels,
      baseAttributes: profile.attributes,
    );
  }

  final String name;
  final String homeCity;
  final List<String> visited;
  final List<String> wantToVisit;
  final Map<String, List<String>> selections;

  /// Digits only (no thousands separators), e.g. "700000".
  final String dailyBudget;
  final String freeText;

  /// code/ref -> label typed by the user for choices outside the catalog.
  final Map<String, String> customLabels;
  final Map<String, String> baseAttributes;

  OnboardingDraft copyWith({
    String? name,
    String? homeCity,
    List<String>? visited,
    List<String>? wantToVisit,
    Map<String, List<String>>? selections,
    String? dailyBudget,
    String? freeText,
    Map<String, String>? customLabels,
  }) => OnboardingDraft(
    name: name ?? this.name,
    homeCity: homeCity ?? this.homeCity,
    visited: visited ?? this.visited,
    wantToVisit: wantToVisit ?? this.wantToVisit,
    selections: selections ?? this.selections,
    dailyBudget: dailyBudget ?? this.dailyBudget,
    freeText: freeText ?? this.freeText,
    customLabels: customLabels ?? this.customLabels,
    baseAttributes: baseAttributes,
  );

  List<String> answers(String dimension) => selections[dimension] ?? const [];

  bool get hasValidDailyBudget =>
      _budgetDigits.hasMatch(dailyBudget) &&
      int.parse(dailyBudget) <= maxDailyBudgetVnd;

  bool isStepValid(OnboardingStep step) {
    switch (step) {
      case OnboardingStep.name:
        return name.trim().isNotEmpty;
      case OnboardingStep.homeCity:
      case OnboardingStep.visited:
      case OnboardingStep.bucketList:
        return true;
      case OnboardingStep.budget:
        return answers(Dimension.budgetTier).isNotEmpty && hasValidDailyBudget;
      case OnboardingStep.travelParty:
      case OnboardingStep.stay:
      case OnboardingStep.food:
      case OnboardingStep.activity:
        return answers(preferenceFor(step)!.dimension).isNotEmpty;
      case OnboardingStep.note:
        return freeText.length <= maxFreeTextLength;
    }
  }

  /// First step that blocks submission, or null when the whole draft is valid.
  OnboardingStep? get firstInvalidStep {
    for (final step in OnboardingStep.values) {
      if (!isStepValid(step)) return step;
    }
    return null;
  }

  /// Toggles a chip. Single-answer dimensions replace; multi-answer toggle.
  OnboardingDraft toggleOption(
    String dimension,
    String code, {
    bool single = false,
  }) {
    final current = answers(dimension);
    final next = single
        ? [code]
        : current.contains(code)
        ? [
            for (final item in current)
              if (item != code) item,
          ]
        : [...current, code];
    return copyWith(selections: {...selections, dimension: next});
  }

  /// Adds/removes a place; returns the same draft when the list is full.
  OnboardingDraft togglePlace(OnboardingStep step, String ref) {
    final isVisited = step == OnboardingStep.visited;
    final current = isVisited ? visited : wantToVisit;
    List<String> next;
    if (current.contains(ref)) {
      next = [
        for (final item in current)
          if (item != ref) item,
      ];
    } else {
      if (current.length >= maxPlacesPerList) return this;
      next = [...current, ref];
    }
    return isVisited ? copyWith(visited: next) : copyWith(wantToVisit: next);
  }

  /// Builds the request the backend accepts, mirroring the web sanitization.
  OnboardingSaveRequest toRequest(int version) {
    final cleaned = <String, List<String>>{};
    for (final entry in selections.entries) {
      if (!Dimension.allowed.contains(entry.key)) continue;
      final codes = [
        for (final code in entry.value)
          if (_optionCode.hasMatch(code)) code,
      ];
      if (codes.isNotEmpty) cleaned[entry.key] = codes;
    }
    cleaned.putIfAbsent(Dimension.travelParty, () => ['SOLO']);
    cleaned.putIfAbsent(Dimension.budgetTier, () => ['MID_RANGE']);
    cleaned[Dimension.dailyBudgetVnd] = [
      hasValidDailyBudget ? dailyBudget : defaultDailyBudgetVnd,
    ];

    List<String> refs(List<String> values) => [
      for (final value in values)
        if (_placeRef.hasMatch(value)) value,
    ];

    final attributes = {...baseAttributes};
    final city = homeCity.trim();
    if (city.isNotEmpty) {
      attributes[_homeCityKey] = jsonEncode({
        'name': city,
        'placeRef': toPlaceRef(city),
        'country': 'Vietnam',
      });
    }
    if (customLabels.isNotEmpty) {
      attributes[_customLabelsKey] = jsonEncode(customLabels);
    }

    final note = freeText.trim();
    return OnboardingSaveRequest(
      version: version,
      selections: cleaned,
      visited: refs(visited),
      wantToVisit: refs(wantToVisit),
      attributes: attributes,
      freeText: note.isEmpty
          ? null
          : (note.length > maxFreeTextLength
                ? note.substring(0, maxFreeTextLength)
                : note),
    );
  }
}
