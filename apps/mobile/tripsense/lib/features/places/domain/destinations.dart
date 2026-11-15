import 'place.dart';

/// Destinations offered on Explore (apps/web .../explore-feed-header.tsx).
class DestinationPreset {
  const DestinationPreset({
    required this.id,
    required this.name,
    required this.lat,
    required this.lng,
    required this.defaultQuery,
  });

  final String id;
  final String name;
  final double lat;
  final double lng;
  final String defaultQuery;
}

const destinationPresets = <DestinationPreset>[
  DestinationPreset(
    id: 'danang',
    name: 'Đà Nẵng',
    lat: 16.0544,
    lng: 108.2022,
    defaultQuery: 'địa điểm nổi tiếng ở Đà Nẵng',
  ),
  DestinationPreset(
    id: 'hue',
    name: 'Huế',
    lat: 16.4637,
    lng: 107.5909,
    defaultQuery: 'địa điểm nổi tiếng ở Huế',
  ),
  DestinationPreset(
    id: 'hoian',
    name: 'Hội An',
    lat: 15.8801,
    lng: 108.338,
    defaultQuery: 'địa điểm nổi tiếng ở Hội An',
  ),
];

/// Category tabs under the search bar.
enum ExploreTab {
  forYou(null, 'địa điểm nổi tiếng'),
  food(PlaceCategory.food, 'nhà hàng địa phương'),
  cafes(PlaceCategory.cafe, 'quán cà phê'),
  stays(PlaceCategory.stay, 'khách sạn'),
  attractions(PlaceCategory.attraction, 'điểm tham quan');

  const ExploreTab(this.category, this.queryKeyword);

  final PlaceCategory? category;
  final String queryKeyword;
}

/// "quán cà phê" + Đà Nẵng -> "quán cà phê ở Đà Nẵng". Any mention of the
/// destination already typed by the user is removed first (same as the web).
String buildSearchQuery(String raw, DestinationPreset destination) {
  final cleaned = raw
      .replaceAll(
        RegExp(
          '\\s*(ở|tại|in)?\\s*${RegExp.escape(destination.name)}\\s*',
          caseSensitive: false,
        ),
        ' ',
      )
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  return '${cleaned.isEmpty ? raw.trim() : cleaned} ở ${destination.name}';
}
