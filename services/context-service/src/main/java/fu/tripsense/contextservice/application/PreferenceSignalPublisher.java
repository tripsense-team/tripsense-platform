package fu.tripsense.contextservice.application;

import fu.tripsense.contextservice.domain.OnboardingProfile;
import java.util.UUID;

public interface PreferenceSignalPublisher {
  void replaceFor(OnboardingProfile profile);

  void deleteForUser(UUID userId);
}
