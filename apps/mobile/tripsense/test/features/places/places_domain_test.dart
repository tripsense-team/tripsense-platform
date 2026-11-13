import 'package:flutter_test/flutter_test.dart';
import 'package:trip/features/places/data/place_json.dart';
import 'package:trip/features/places/domain/destinations.dart';
import 'package:trip/features/places/domain/opening_hours.dart';
import 'package:trip/features/places/domain/place.dart';

void main() {
  group('isApprovedPhotoUrl', () {
    test('accepts https photos from approved hosts', () {
      expect(isApprovedPhotoUrl('https://res.cloudinary.com/x/a.jpg'), isTrue);
      expect(isApprovedPhotoUrl('https://lh3.googleusercontent.com/a'), isTrue);
    });

    test('rejects http, unknown hosts, credentials and secret params', () {
      expect(isApprovedPhotoUrl('http://res.cloudinary.com/a.jpg'), isFalse);
      expect(isApprovedPhotoUrl('https://evil.example.com/a.jpg'), isFalse);
      expect(isApprovedPhotoUrl('https://u:p@res.cloudinary.com/a'), isFalse);
      expect(
        isApprovedPhotoUrl('https://maps.mapvina.com/a?api_key=1'),
        isFalse,
      );
      expect(isApprovedPhotoUrl(null), isFalse);
      expect(isApprovedPhotoUrl(''), isFalse);
    });
  });

  group('placeFromJson', () {
    test('parses fields and drops unapproved photos', () {
      final place = placeFromJson({
        'id': 'p1',
        'name': ' Cafe A ',
        'categories': ['coffee_shop'],
        'rating': 4,
        'userRatingCount': 12,
        'location': {'lat': 16.05, 'lng': 108.2},
        'photos': [
          'https://evil.example.com/a.jpg',
          'https://res.cloudinary.com/a.jpg',
        ],
        'reviews': [
          {'authorName': 'Linh', 'rating': 5, 'text': 'Great'},
        ],
      });
      expect(place.id, 'p1');
      expect(place.name, 'Cafe A');
      expect(place.rating, 4.0);
      expect(place.ratingCount, 12);
      expect(place.photoUrls, ['https://res.cloudinary.com/a.jpg']);
      expect(place.coverUrl, 'https://res.cloudinary.com/a.jpg');
      expect(place.reviews.single.author, 'Linh');
      expect(place.categoryLabel, 'Coffee shop');
    });

    test('is tolerant of missing fields and derives an id from the point', () {
      final place = placeFromJson({
        'location': {'lat': 1.0, 'lng': 2.0},
      });
      expect(place.id, 'place_1.00000_2.00000');
      expect(place.name, '');
      expect(place.photoUrls, isEmpty);
      expect(place.hasRating, isFalse);
    });

    test('mergedWith keeps list data when details are sparse', () {
      const base = Place(id: 'p', name: 'A', address: 'X', rating: 4);
      final merged = base.mergedWith(
        const Place(id: 'p', name: '', phone: '1'),
      );
      expect(merged.name, 'A');
      expect(merged.address, 'X');
      expect(merged.phone, '1');
    });
  });

  group('opening hours', () {
    const raw =
        'Thứ Hai: 07:00–22:00; Thứ Ba: 08:00–20:00; bad; Chủ Nhật: Đóng cửa';

    test('parses weekly rows and skips malformed parts', () {
      final days = parseOpeningHours(raw);
      expect(days.map((d) => d.day), ['Thứ Hai', 'Thứ Ba', 'Chủ Nhật']);
      expect(parseOpeningHours(null), isEmpty);
      expect(parseOpeningHours('  '), isEmpty);
    });

    test('finds today by weekday', () {
      expect(todayOpeningHours(raw, DateTime(2026, 11, 9)), '07:00–22:00');
      expect(todayOpeningHours(raw, DateTime(2026, 11, 15)), 'Đóng cửa');
      expect(todayOpeningHours(raw, DateTime(2026, 11, 11)), isNull);
    });
  });

  group('buildSearchQuery', () {
    final danang = destinationPresets.first;

    test('appends the destination', () {
      expect(buildSearchQuery('quán cà phê', danang), 'quán cà phê ở Đà Nẵng');
    });

    test('does not duplicate a destination the user already typed', () {
      expect(
        buildSearchQuery('quán cà phê tại Đà Nẵng', danang),
        'quán cà phê ở Đà Nẵng',
      );
    });

    test('tabs map to categories', () {
      expect(ExploreTab.forYou.category, isNull);
      expect(ExploreTab.cafes.category, PlaceCategory.cafe);
    });
  });
}
