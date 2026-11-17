import 'package:flutter_test/flutter_test.dart';
import 'package:trip/features/auth/domain/app_user.dart';

void main() {
  group('parseUserRole', () {
    test('normalizes backend role strings', () {
      expect(parseUserRole('ROLE_ADMIN'), UserRole.admin);
      expect(parseUserRole('admin'), UserRole.admin);
      expect(parseUserRole(' ROLE_MODERATOR '), UserRole.moderator);
      expect(parseUserRole('PARTNER'), UserRole.partner);
      expect(parseUserRole('ROLE_USER'), UserRole.user);
    });

    test('defaults to user for missing or unknown values', () {
      expect(parseUserRole(null), UserRole.user);
      expect(parseUserRole('SOMETHING_ELSE'), UserRole.user);
    });
  });

  group('AppUser', () {
    test('fromJson reads the UserDto fields', () {
      final user = AppUser.fromJson({
        'id': 'u1',
        'email': 'a@b.com',
        'role': 'ROLE_USER',
        'hasPassword': false,
      });

      expect(user.id, 'u1');
      expect(user.email, 'a@b.com');
      expect(user.role, UserRole.user);
      expect(user.hasPassword, isFalse);
      expect(user.isTraveler, isTrue);
    });

    test('only USER accounts count as travelers', () {
      for (final role in UserRole.values) {
        final user = AppUser(
          id: '1',
          email: 'x@y.z',
          role: role,
          hasPassword: true,
        );
        expect(user.isTraveler, role == UserRole.user);
      }
    });

    test('displayName falls back to email and withProfile keeps identity', () {
      const user = AppUser(
        id: '1',
        email: 'x@y.z',
        role: UserRole.user,
        hasPassword: true,
      );
      expect(user.displayName, 'x@y.z');

      final enriched = user.withProfile(
        name: 'Alex',
        avatarUrl: 'https://img/a.png',
        onboardingRequired: true,
      );
      expect(enriched.displayName, 'Alex');
      expect(enriched.avatarUrl, 'https://img/a.png');
      expect(enriched.onboardingRequired, isTrue);
      expect(enriched.id, user.id);
      expect(enriched.email, user.email);
    });
  });
}
