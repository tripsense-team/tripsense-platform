import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trip/core/errors/app_failure.dart';
import 'package:trip/core/network/access_token_store.dart';
import 'package:trip/core/network/token_refresher.dart';
import 'package:trip/features/auth/data/auth_repository_impl.dart';
import 'package:trip/features/auth/domain/app_user.dart';

import '../../support/fake_http_adapter.dart';

const _userJson = {
  'id': 'u1',
  'email': 'a@b.com',
  'role': 'ROLE_USER',
  'hasPassword': true,
};

void main() {
  late AccessTokenStore store;
  late FakeHttpAdapter api;
  late FakeHttpAdapter refresh;
  late CookieJar jar;
  late AuthRepositoryImpl repo;
  var profileStatus = 200;
  var refreshStatus = 200;
  var logoutStatus = 200;

  setUp(() {
    profileStatus = 200;
    refreshStatus = 200;
    logoutStatus = 200;
    store = AccessTokenStore();
    jar = CookieJar();

    api = FakeHttpAdapter((o) {
      final key = '${o.method} ${o.path}';
      final email = (o.data is Map) ? (o.data as Map)['email'] : null;
      return switch (key) {
        'POST /api/auth/login' when email == 'bad@x.com' => (
          401,
          {'message': 'Invalid email or password'},
        ),
        'POST /api/auth/login' => (
          200,
          {
            'data': {'accessToken': 'tok', 'user': _userJson},
          },
        ),
        'POST /api/auth/register' when email == 'dup@x.com' => (
          409,
          {'message': 'Email already registered'},
        ),
        'GET /api/users/me' => (200, {'data': _userJson}),
        'GET /api/users/profile/u1' => profileStatus == 200
            ? (
                200,
                {
                  'data': {
                    'displayName': 'Alex',
                    'avatarUrl': 'https://img/a.png',
                    'onboardingRequired': true,
                  },
                },
              )
            : (profileStatus, {'message': 'boom'}),
        'POST /api/auth/logout' => (logoutStatus, {}),
        _ => (200, {}),
      };
    });

    refresh = FakeHttpAdapter(
      (_) => refreshStatus == 200
          ? (
              200,
              {
                'data': {'accessToken': 'fresh'},
              },
            )
          : (401, {'message': 'expired'}),
    );

    repo = AuthRepositoryImpl(
      dio: dioWith(api),
      store: store,
      refresher: TokenRefresher(dioWith(refresh), store),
      cookieJar: jar,
    );
  });

  group('login', () {
    test('stores the token and returns the user with profile data', () async {
      final user = await repo.login(email: 'a@b.com', password: 'secret1');

      expect(store.token, 'tok');
      expect(user.role, UserRole.user);
      expect(user.name, 'Alex');
      expect(user.avatarUrl, 'https://img/a.png');
      expect(user.onboardingRequired, isTrue);
    });

    test('sends credentials without a bearer header (public call)', () async {
      await repo.login(email: 'a@b.com', password: 'secret1');

      final request = api.requests.first;
      expect(request.path, '/api/auth/login');
      expect(request.data, {'email': 'a@b.com', 'password': 'secret1'});
    });

    test('maps bad credentials to an unauthorized failure', () async {
      await expectLater(
        repo.login(email: 'bad@x.com', password: 'nope'),
        throwsA(
          isA<AppFailure>()
              .having((f) => f.type, 'type', AppFailureType.unauthorized)
              .having(
                (f) => f.serverMessage,
                'message',
                'Invalid email or password',
              ),
        ),
      );
      expect(store.token, isNull);
    });

    test('still signs in when the profile call fails', () async {
      profileStatus = 500;

      final user = await repo.login(email: 'a@b.com', password: 'secret1');

      expect(user.id, 'u1');
      expect(user.name, isNull);
      expect(store.token, 'tok');
    });
  });

  group('restoreSession', () {
    test('returns null when the refresh cookie is rejected', () async {
      refreshStatus = 401;
      expect(await repo.restoreSession(), isNull);
      expect(store.token, isNull);
    });

    test('returns the current user after a successful refresh', () async {
      final user = await repo.restoreSession();

      expect(store.token, 'fresh');
      expect(user?.email, 'a@b.com');
      expect(user?.name, 'Alex');
    });
  });

  group('account flows', () {
    test('register surfaces conflicts with the sanitized server text', () async {
      await expectLater(
        repo.register(email: 'dup@x.com', password: 'secret1'),
        throwsA(
          isA<AppFailure>()
              .having((f) => f.type, 'type', AppFailureType.conflict)
              .having((f) => f.serverMessage, 'msg', 'Email already registered'),
        ),
      );
    });

    test('verify, resend, forgot and reset post the expected bodies', () async {
      await repo.verifyEmail(email: 'a@b.com', code: '123456');
      await repo.resendCode(email: 'a@b.com');
      await repo.forgotPassword(email: 'a@b.com');
      await repo.resetPassword(
        email: 'a@b.com',
        code: '654321',
        newPassword: 'newpass1',
      );

      final calls = {for (final r in api.requests) r.path: r.data};
      expect(calls['/api/auth/verify-email'], {
        'email': 'a@b.com',
        'code': '123456',
      });
      expect(calls['/api/auth/resend-code'], {'email': 'a@b.com'});
      expect(calls['/api/auth/forgot-password'], {'email': 'a@b.com'});
      expect(calls['/api/auth/reset-password'], {
        'email': 'a@b.com',
        'otp': '654321',
        'newPassword': 'newpass1',
      });
    });
  });

  group('logout', () {
    test('clears the token and cookies', () async {
      store.set('tok');
      await jar.saveFromResponse(Uri.parse('http://gateway'), [
        Cookie('refreshToken', 'abc'),
      ]);

      await repo.logout();

      expect(store.token, isNull);
      expect(await jar.loadForRequest(Uri.parse('http://gateway')), isEmpty);
    });

    test('still clears local credentials when the network call fails', () async {
      logoutStatus = 500;
      store.set('tok');

      await repo.logout();

      expect(store.token, isNull);
    });
  });
}
