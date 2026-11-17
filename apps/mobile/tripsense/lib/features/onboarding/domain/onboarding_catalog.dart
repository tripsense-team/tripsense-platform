/// Static onboarding content, mirrored from the web
/// (`apps/web/tripsense/src/features/onboarding/constants`).
library;

/// The ten wizard steps, in order.
enum OnboardingStep {
  name,
  homeCity,
  visited,
  bucketList,
  travelParty,
  budget,
  stay,
  food,
  activity,
  note;

  /// Steps the user may skip without choosing anything.
  bool get isOptional => switch (this) {
    homeCity || visited || bucketList || note => true,
    _ => false,
  };
}

/// Preference dimensions accepted by the backend.
abstract final class Dimension {
  static const travelParty = 'TRAVEL_PARTY';
  static const budgetTier = 'BUDGET_TIER';
  static const dailyBudgetVnd = 'DAILY_BUDGET_VND';
  static const stayStyle = 'STAY_STYLE';
  static const foodStyle = 'FOOD_STYLE';
  static const activityInterest = 'ACTIVITY_INTEREST';

  static const allowed = {
    travelParty,
    budgetTier,
    dailyBudgetVnd,
    stayStyle,
    foodStyle,
    activityInterest,
  };
}

class PreferenceStep {
  const PreferenceStep({
    required this.step,
    required this.dimension,
    required this.options,
    this.single = false,
  });

  final OnboardingStep step;
  final String dimension;
  final List<String> options;

  /// Exactly one answer (radio) instead of many (chips).
  final bool single;
}

const preferenceSteps = <PreferenceStep>[
  PreferenceStep(
    step: OnboardingStep.travelParty,
    dimension: Dimension.travelParty,
    single: true,
    options: ['SOLO', 'COUPLE', 'FRIENDS', 'FAMILY'],
  ),
  PreferenceStep(
    step: OnboardingStep.budget,
    dimension: Dimension.budgetTier,
    single: true,
    options: ['BUDGET', 'MID_RANGE', 'PREMIUM'],
  ),
  PreferenceStep(
    step: OnboardingStep.stay,
    dimension: Dimension.stayStyle,
    options: ['HOTEL', 'HOMESTAY', 'RESORT', 'HOSTEL'],
  ),
  PreferenceStep(
    step: OnboardingStep.food,
    dimension: Dimension.foodStyle,
    options: ['LOCAL_FOOD', 'STREET_FOOD', 'FINE_DINING', 'CAFE'],
  ),
  PreferenceStep(
    step: OnboardingStep.activity,
    dimension: Dimension.activityInterest,
    options: ['NATURE', 'HIKING', 'CULTURE', 'BEACH', 'NIGHTLIFE'],
  ),
];

PreferenceStep? preferenceFor(OnboardingStep step) {
  for (final preference in preferenceSteps) {
    if (preference.step == step) return preference;
  }
  return null;
}

class Destination {
  const Destination(this.name, {this.flag = '', this.region = ''});

  final String name;
  final String flag;
  final String region;

  String get ref => toPlaceRef(name);
}

const popularDestinations = <Destination>[
  Destination('Đà Nẵng', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Đà Lạt', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Hà Nội', flag: '🇻🇳', region: 'Vietnam'),
  Destination('TP. Hồ Chí Minh', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Phú Quốc', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Hội An', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Nha Trang', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Sa Pa', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Ninh Bình', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Hà Giang', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Huế', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Quy Nhơn', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Vũng Tàu', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Phong Nha', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Cần Thơ', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Bangkok', flag: '🇹🇭', region: 'Asia'),
  Destination('Tokyo', flag: '🇯🇵', region: 'Asia'),
  Destination('Singapore', flag: '🇸🇬', region: 'Asia'),
  Destination('Seoul', flag: '🇰🇷', region: 'Asia'),
  Destination('Bali', flag: '🇮🇩', region: 'Asia'),
  Destination('Taipei', flag: '🇹🇼', region: 'Asia'),
];

const popularHomeCities = <Destination>[
  Destination('TP. Hồ Chí Minh', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Hà Nội', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Đà Nẵng', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Cần Thơ', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Hải Phòng', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Nha Trang', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Huế', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Đà Lạt', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Quy Nhơn', flag: '🇻🇳', region: 'Vietnam'),
  Destination('Vũng Tàu', flag: '🇻🇳', region: 'Vietnam'),
];

/// Quick-add chips for the free-text note (localized by key in the UI).
enum QuickTag { photo, cafe, nature, beach, trek, vegetarian }

const maxPlacesPerList = 20;
const maxFreeTextLength = 2000;
const maxDailyBudgetVnd = 1000000000;
const defaultDailyBudgetVnd = '500000';

const _vietnameseGroups = {
  'a': 'àáạảãâầấậẩẫăằắặẳẵ',
  'e': 'èéẹẻẽêềếệểễ',
  'i': 'ìíịỉĩ',
  'o': 'òóọỏõôồốộổỗơờớợởỡ',
  'u': 'ùúụủũưừứựửữ',
  'y': 'ỳýỵỷỹ',
  'd': 'đ',
};

final _foldTable = {
  for (final entry in _vietnameseGroups.entries)
    for (final rune in entry.value.runes) String.fromCharCode(rune): entry.key,
};

/// Lowercases and strips Vietnamese diacritics (đ -> d).
String foldVietnamese(String input) {
  final buffer = StringBuffer();
  for (final char in input.toLowerCase().split('')) {
    buffer.write(_foldTable[char] ?? char);
  }
  return buffer.toString();
}

String _slug(String input, String separator, int maxLength) {
  final folded = foldVietnamese(input)
      .replaceAll(RegExp(r'[^a-z0-9_-]'), separator)
      .replaceAll(RegExp('$separator+'), separator)
      .replaceAll(RegExp('^$separator|$separator\$'), '');
  return folded.length > maxLength ? folded.substring(0, maxLength) : folded;
}

/// Stable place reference, e.g. "Đà Nẵng" -> "da-nang" (same as web).
String toPlaceRef(String name) => _slug(name, '-', 80);

/// Backend option code for a user-typed choice, e.g. "Đi chợ" -> "DI_CHO".
String toOptionCode(String name) {
  final code = _slug(name, '_', 80).toUpperCase();
  return code.isEmpty ? 'CUSTOM' : code;
}
