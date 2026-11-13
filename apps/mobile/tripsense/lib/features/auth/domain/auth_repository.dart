import 'app_user.dart';

/// All methods throw `AppFailure` (never raw Dio errors).
abstract interface class AuthRepository {
  /// Creates an unverified account; the backend emails a 6-digit code.
  Future<void> register({required String email, required String password});

  Future<void> verifyEmail({required String email, required String code});

  Future<void> resendCode({required String email});

  Future<AppUser> login({required String email, required String password});

  /// Restores a session from the persisted refresh cookie; null when none.
  Future<AppUser?> restoreSession();

  Future<void> forgotPassword({required String email});

  Future<void> resetPassword({
    required String email,
    required String code,
    required String newPassword,
  });

  /// Best effort: always clears local credentials.
  Future<void> logout();
}
