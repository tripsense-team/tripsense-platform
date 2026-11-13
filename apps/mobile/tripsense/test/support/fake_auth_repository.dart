import 'package:trip/features/auth/domain/app_user.dart';
import 'package:trip/features/auth/domain/auth_repository.dart';

const travelerUser = AppUser(
  id: 'u1',
  email: 'a@b.com',
  role: UserRole.user,
  hasPassword: true,
  name: 'Alex Traveler',
);

/// In-memory [AuthRepository] that records calls; set `*Error` to simulate failures.
class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository({this.restored, this.loginResult = travelerUser});

  AppUser? restored;
  AppUser loginResult;

  Object? loginError;
  Object? registerError;
  Object? verifyError;
  Object? forgotError;
  Object? resetError;

  int logoutCalls = 0;
  final registered = <String>[];
  final verified = <String>[];
  final resent = <String>[];
  final forgot = <String>[];
  final reset = <String>[];

  @override
  Future<AppUser> login({
    required String email,
    required String password,
  }) async {
    final error = loginError;
    if (error != null) throw error;
    return loginResult;
  }

  Object? restoreError;

  @override
  Future<AppUser?> restoreSession() async {
    final error = restoreError;
    if (error != null) throw error;
    return restored;
  }

  @override
  Future<void> logout() async => logoutCalls++;

  @override
  Future<void> register({
    required String email,
    required String password,
  }) async {
    final error = registerError;
    if (error != null) throw error;
    registered.add(email);
  }

  @override
  Future<void> verifyEmail({
    required String email,
    required String code,
  }) async {
    final error = verifyError;
    if (error != null) throw error;
    verified.add('$email:$code');
  }

  @override
  Future<void> resendCode({required String email}) async => resent.add(email);

  @override
  Future<void> forgotPassword({required String email}) async {
    final error = forgotError;
    if (error != null) throw error;
    forgot.add(email);
  }

  @override
  Future<void> resetPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    final error = resetError;
    if (error != null) throw error;
    reset.add('$email:$code');
  }
}
