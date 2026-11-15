import '../domain/place.dart';

const _maxPhotos = 8;

double? _asDouble(Object? value) => value is num ? value.toDouble() : null;

int? _asInt(Object? value) => value is num ? value.toInt() : null;

String? _asText(Object? value) {
  if (value is! String) return null;
  final text = value.trim();
  return text.isEmpty ? null : text;
}

Map<String, dynamic>? _asMap(Object? value) =>
    value is Map ? Map<String, dynamic>.from(value) : null;

List<Map<String, dynamic>> _asMaps(Object? value) => value is List
    ? [
        for (final item in value)
          if (item is Map) Map<String, dynamic>.from(item),
      ]
    : const [];

/// Approved photo URLs in priority order: media, primary photo, gallery, legacy list.
List<String> _photoUrls(Map<String, dynamic> json) {
  final candidates = <String?>[];

  final media = _asMap(json['media']);
  candidates.add(_asText(_asMap(media?['primary'])?['url']));
  for (final asset in _asMaps(media?['gallery'])) {
    candidates.add(_asText(asset['url']));
  }

  for (final evidence in [
    _asMap(json['primaryPhoto']),
    ..._asMaps(json['photoGallery']),
  ]) {
    if (evidence != null && evidence['displayApproved'] == true) {
      candidates.add(_asText(evidence['url']));
    }
  }

  final legacy = json['photos'];
  if (legacy is List) {
    candidates.addAll(legacy.map(_asText));
  }

  final seen = <String>{};
  final urls = <String>[];
  for (final url in candidates) {
    if (url == null || !isApprovedPhotoUrl(url) || !seen.add(url)) continue;
    urls.add(url);
    if (urls.length == _maxPhotos) break;
  }
  return urls;
}

/// Builds a [Place] from place-service JSON (tolerant of missing fields).
Place placeFromJson(Map<String, dynamic> json) {
  final location = _asMap(json['location']);
  final lat = _asDouble(location?['lat']);
  final lng = _asDouble(location?['lng']);
  final id =
      _asText(json['id']) ??
      _asText(json['providerPlaceId']) ??
      (lat != null && lng != null
          ? 'place_${lat.toStringAsFixed(5)}_${lng.toStringAsFixed(5)}'
          : 'place_unknown');

  final categories = json['categories'];
  return Place(
    id: id,
    name: _asText(json['name']) ?? '',
    address: _asText(json['address']),
    city: _asText(json['city']),
    district: _asText(json['district']),
    categories: categories is List
        ? [for (final c in categories) c.toString()]
        : const [],
    rating: _asDouble(json['rating']),
    ratingCount: _asInt(json['userRatingCount']),
    photoUrls: _photoUrls(json),
    location: lat != null && lng != null ? GeoPoint(lat, lng) : null,
    openingHours: _asText(json['openingHours']),
    phone: _asText(json['phone']),
    website: _asText(json['website']),
    description: _asText(json['description']),
    reviews: [
      for (final review in _asMaps(json['reviews']))
        PlaceReview(
          author: _asText(review['authorName']) ?? '',
          rating: _asDouble(review['rating']),
          text: _asText(review['text']),
          relativeTime: _asText(review['relativeTimeDescription']),
        ),
    ],
  );
}

PlaceSuggestion suggestionFromJson(Map<String, dynamic> json) =>
    PlaceSuggestion(
      id: _asText(json['id']) ?? '',
      title: _asText(json['title']) ?? '',
      subtitle: _asText(json['subtitle']),
      category: _asText(json['category']),
    );

List<Map<String, dynamic>> jsonList(Object? value) => _asMaps(value);

Map<String, dynamic>? jsonMap(Object? value) => _asMap(value);
