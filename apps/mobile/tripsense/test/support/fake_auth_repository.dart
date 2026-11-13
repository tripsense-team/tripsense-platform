import 'package:trip/features/auth/domain/app_user.dart';
import 'package:trip/features/auth/domain/auth_repository.dart';

const travelerUser = AppUser(
  id: 'u1',
  email: 'a@b.com',
  role: UserRole.user,
  hasPassword: true,
);

class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository({this.restored, this.loginResult = travelerUser});

  AppUser? restored;
  AppUser loginResult;
  Object? loginError;
  int logoutCalls = 0;

  @override
  Future<AppUser> login({
    required String email,
    required String password,
  }) async {
    final error = loginError;
    if (error != null) throw error;
    return loginResult;
  }

  @override
  Future<AppUser?> restoreSession() async => restored;

  @override
  Future<void> logout() async => logoutCalls++;

  @override
  Future<void> register({
    required String email,
    required String password,
  }) async {}

  @override
  Future<void> verifyEmail({
    required String email,
    required String code,
  }) async {}

  @override
  Future<void> resendCode({required String email}) async {}

  @override
  Future<void> forgotPassword({required String email}) async {}

  @override
  Future<void> resetPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {}
}
