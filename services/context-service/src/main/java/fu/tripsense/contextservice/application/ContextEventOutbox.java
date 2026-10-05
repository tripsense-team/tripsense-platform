package fu.tripsense.contextservice.application;

import fu.tripsense.contextservice.domain.OnboardingProfile;

public interface ContextEventOutbox {
  void recordProfileChanged(OnboardingProfile profile);
}
