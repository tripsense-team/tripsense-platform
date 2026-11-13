import 'onboarding_profile.dart';

/// All methods throw `AppFailure` (never raw Dio errors).
abstract interface class OnboardingRepository {
  /// Loads the saved profile, starting a new one when none exists yet.
  Future<OnboardingProfile> load();

  Future<OnboardingProfile> save(OnboardingSaveRequest request);

  Future<OnboardingProfile> complete(int version);

  /// Tells user-service the profile finished onboarding (clears the gate).
  Future<void> markProfileComplete();

  Future<void> updateDisplayName(String name);
}
