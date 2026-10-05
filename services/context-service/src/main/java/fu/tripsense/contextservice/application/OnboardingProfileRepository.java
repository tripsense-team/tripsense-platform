package fu.tripsense.contextservice.application;

import fu.tripsense.contextservice.domain.OnboardingProfile;
import java.util.Optional;
import java.util.UUID;

public interface OnboardingProfileRepository {
  Optional<OnboardingProfile> findByUserId(UUID userId);

  OnboardingProfile save(OnboardingProfile profile);

  void deleteByUserId(UUID userId);
}
