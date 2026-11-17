import '../../../l10n/gen/app_localizations.dart';
import '../domain/onboarding_catalog.dart';

/// Localized label for a catalog option code; falls back to the user's own
/// typed label, then to the raw code.
String optionLabel(
  AppLocalizations l10n,
  String code, {
  Map<String, String> customLabels = const {},
}) {
  final label = switch (code) {
    'SOLO' => l10n.optSolo,
    'COUPLE' => l10n.optCouple,
    'FRIENDS' => l10n.optFriends,
    'FAMILY' => l10n.optFamily,
    'BUDGET' => l10n.optBudget,
    'MID_RANGE' => l10n.optMidRange,
    'PREMIUM' => l10n.optPremium,
    'HOTEL' => l10n.optHotel,
    'HOMESTAY' => l10n.optHomestay,
    'RESORT' => l10n.optResort,
    'HOSTEL' => l10n.optHostel,
    'LOCAL_FOOD' => l10n.optLocalFood,
    'STREET_FOOD' => l10n.optStreetFood,
    'FINE_DINING' => l10n.optFineDining,
    'CAFE' => l10n.optCafe,
    'NATURE' => l10n.optNature,
    'HIKING' => l10n.optHiking,
    'CULTURE' => l10n.optCulture,
    'BEACH' => l10n.optBeach,
    'NIGHTLIFE' => l10n.optNightlife,
    _ => null,
  };
  return label ?? customLabels[code] ?? code;
}

String quickTagLabel(AppLocalizations l10n, QuickTag tag) => switch (tag) {
  QuickTag.photo => l10n.onbTagPhoto,
  QuickTag.cafe => l10n.onbTagCafe,
  QuickTag.nature => l10n.onbTagNature,
  QuickTag.beach => l10n.onbTagBeach,
  QuickTag.trek => l10n.onbTagTrek,
  QuickTag.vegetarian => l10n.onbTagVegetarian,
};

({String title, String subtitle}) stepCopy(
  AppLocalizations l10n,
  OnboardingStep step,
) => switch (step) {
  OnboardingStep.name => (title: l10n.onbNameTitle, subtitle: ''),
  OnboardingStep.homeCity => (
    title: l10n.onbHomeTitle,
    subtitle: l10n.onbHomeSubtitle,
  ),
  OnboardingStep.visited => (
    title: l10n.onbVisitedTitle,
    subtitle: l10n.onbVisitedSubtitle,
  ),
  OnboardingStep.bucketList => (
    title: l10n.onbBucketTitle,
    subtitle: l10n.onbBucketSubtitle,
  ),
  OnboardingStep.travelParty => (
    title: l10n.onbPartyTitle,
    subtitle: l10n.onbPartySubtitle,
  ),
  OnboardingStep.budget => (
    title: l10n.onbBudgetTitle,
    subtitle: l10n.onbBudgetSubtitle,
  ),
  OnboardingStep.stay => (
    title: l10n.onbStayTitle,
    subtitle: l10n.onbStaySubtitle,
  ),
  OnboardingStep.food => (
    title: l10n.onbFoodTitle,
    subtitle: l10n.onbFoodSubtitle,
  ),
  OnboardingStep.activity => (
    title: l10n.onbActivityTitle,
    subtitle: l10n.onbActivitySubtitle,
  ),
  OnboardingStep.note => (
    title: l10n.onbNoteTitle,
    subtitle: l10n.onbNoteSubtitle,
  ),
};
