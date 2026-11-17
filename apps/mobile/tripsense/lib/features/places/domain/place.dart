/// Browse categories understood by `/api/places/search?category=`.
enum PlaceCategory {
  food('FOOD'),
  cafe('CAFE'),
  stay('STAY'),
  attraction('ATTRACTION');

  const PlaceCategory(this.apiValue);
  final String apiValue;
}

class GeoPoint {
  const GeoPoint(this.lat, this.lng);

  final double lat;
  final double lng;
}

/// Photo hosts the web is allowed to render (apps/web .../approved-photo.ts).
const _approvedHosts = {
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
  'ziomap-api.socibi.com',
  'res.cloudinary.com',
  'maps.mapvina.com',
};

final _secretParam = RegExp(r'^(key|api_key|token|secret)$', caseSensitive: false);

/// Only https photos from approved hosts, never with credentials in the URL.
bool isApprovedPhotoUrl(String? raw) {
  if (raw == null || raw.isEmpty) return false;
  final uri = Uri.tryParse(raw);
  if (uri == null || uri.scheme != 'https' || uri.userInfo.isNotEmpty) {
    return false;
  }
  final host = uri.host.toLowerCase();
  final hostOk =
      _approvedHosts.contains(host) || host.endsWith('.googleusercontent.com');
  if (!hostOk) return false;
  return !uri.queryParameters.keys.any(_secretParam.hasMatch);
}

/// A place returned by place-service / recommendation-service.
class Place {
  const Place({
    required this.id,
    required this.name,
    this.address,
    this.city,
    this.district,
    this.categories = const [],
    this.rating,
    this.ratingCount,
    this.photoUrls = const [],
    this.location,
    this.openingHours,
    this.phone,
    this.website,
    this.description,
    this.reviews = const [],
  });

  final String id;
  final String name;
  final String? address;
  final String? city;
  final String? district;
  final List<String> categories;
  final double? rating;
  final int? ratingCount;

  /// Approved photo URLs only (first = cover).
  final List<String> photoUrls;
  final GeoPoint? location;

  /// Raw hours text, e.g. "Thứ Hai: 07:00–22:00; Thứ Ba: ...".
  final String? openingHours;
  final String? phone;
  final String? website;
  final String? description;
  final List<PlaceReview> reviews;

  String? get coverUrl => photoUrls.isEmpty ? null : photoUrls.first;

  bool get hasRating => (rating ?? 0) > 0;

  /// Human label of the main category ("coffee_shop" -> "Coffee shop").
  String? get categoryLabel {
    if (categories.isEmpty) return null;
    final raw = categories.first.replaceAll('_', ' ').trim();
    return raw.isEmpty ? null : raw[0].toUpperCase() + raw.substring(1);
  }

  /// Merges richer detail data over a list item, keeping list fields as a fallback.
  Place mergedWith(Place details) => Place(
    id: details.id.isEmpty ? id : details.id,
    name: details.name.isEmpty ? name : details.name,
    address: details.address ?? address,
    city: details.city ?? city,
    district: details.district ?? district,
    categories: details.categories.isEmpty ? categories : details.categories,
    rating: details.rating ?? rating,
    ratingCount: details.ratingCount ?? ratingCount,
    photoUrls: details.photoUrls.isEmpty ? photoUrls : details.photoUrls,
    location: details.location ?? location,
    openingHours: details.openingHours ?? openingHours,
    phone: details.phone ?? phone,
    website: details.website ?? website,
    description: details.description ?? description,
    reviews: details.reviews.isEmpty ? reviews : details.reviews,
  );
}

class PlaceReview {
  const PlaceReview({
    required this.author,
    this.rating,
    this.text,
    this.relativeTime,
  });

  final String author;
  final double? rating;
  final String? text;
  final String? relativeTime;
}

/// One row of the search-as-you-type dropdown.
class PlaceSuggestion {
  const PlaceSuggestion({
    required this.id,
    required this.title,
    this.subtitle,
    this.category,
  });

  final String id;
  final String title;
  final String? subtitle;
  final String? category;
}
