import 'package:trip/features/onboarding/domain/onboarding_profile.dart';
import 'package:trip/features/onboarding/domain/onboarding_repository.dart';

OnboardingProfile inProgress({int version = 1}) =>
    OnboardingProfile(version: version, completed: false);

/// In-memory [OnboardingRepository]; set `*Errors` queues to simulate failures.
class FakeOnboardingRepository implements OnboardingRepository {
  FakeOnboardingRepository({OnboardingProfile? profile})
    : profile = profile ?? inProgress();

  OnboardingProfile profile;

  /// Errors thrown (in order) by the next calls of each method.
  final loadErrors = <Object>[];
  final saveErrors = <Object>[];
  final completeErrors = <Object>[];
  Object? nameError;

  final saved = <OnboardingSaveRequest>[];
  final completedVersions = <int>[];
  final names = <String>[];
  int markCalls = 0;
  int loadCalls = 0;

  @override
  Future<OnboardingProfile> load() async {
    loadCalls++;
    if (loadErrors.isNotEmpty) throw loadErrors.removeAt(0);
    return profile;
  }

  @override
  Future<OnboardingProfile> save(OnboardingSaveRequest request) async {
    if (saveErrors.isNotEmpty) throw saveErrors.removeAt(0);
    saved.add(request);
    return OnboardingProfile(version: request.version + 1, completed: false);
  }

  @override
  Future<OnboardingProfile> complete(int version) async {
    if (completeErrors.isNotEmpty) throw completeErrors.removeAt(0);
    completedVersions.add(version);
    return OnboardingProfile(version: version + 1, completed: true);
  }

  @override
  Future<void> markProfileComplete() async => markCalls++;

  @override
  Future<void> updateDisplayName(String name) async {
    final error = nameError;
    if (error != null) throw error;
    names.add(name);
  }
}
