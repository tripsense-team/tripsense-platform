package fu.tripsense.contextservice.adapter.in.web;

import fu.tripsense.contextservice.application.*;
import fu.tripsense.contextservice.security.CurrentUserProvider;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/context")
public class OnboardingController {
  private final OnboardingService onboarding;
  private final PreferenceSignalReader signals;
  private final PreferenceDimensionCatalog dimensions;
  private final CurrentUserProvider currentUser;

  public OnboardingController(
      OnboardingService onboarding,
      PreferenceSignalReader signals,
      PreferenceDimensionCatalog dimensions,
      CurrentUserProvider currentUser) {
    this.onboarding = onboarding;
    this.signals = signals;
    this.dimensions = dimensions;
    this.currentUser = currentUser;
  }

  @GetMapping("/onboarding")
  public OnboardingResponse getOnboarding() {
    return OnboardingResponse.from(
        onboarding
            .find(currentUser.requiredUser().id())
            .orElseThrow(() -> new java.util.NoSuchElementException("Onboarding has not started")));
  }

  @PostMapping("/onboarding/start")
  public OnboardingResponse startOnboarding() {
    return OnboardingResponse.from(onboarding.start(currentUser.requiredUser().id()));
  }

  @PutMapping("/onboarding")
  public OnboardingResponse update(@Valid @RequestBody UpdateOnboardingRequest request) {
    return OnboardingResponse.from(
        onboarding.save(
            currentUser.requiredUser().id(),
            new OnboardingCommand(
                request.version(),
                request.selections(),
                request.places(),
                request.attributes(),
                request.freeText())));
  }

  @PostMapping("/onboarding/complete")
  public OnboardingResponse complete(@Valid @RequestBody CompleteOnboardingRequest request) {
    return OnboardingResponse.from(
        onboarding.complete(currentUser.requiredUser().id(), request.version()));
  }

  @DeleteMapping("/onboarding")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete() {
    onboarding.delete(currentUser.requiredUser().id());
  }

  @GetMapping("/preferences")
  public List<PreferenceResponse> preferences(
      @RequestParam(defaultValue = "TRIP_PLANNING") String purpose) {
    if (!"TRIP_PLANNING".equals(purpose))
      throw new IllegalArgumentException("Unsupported preference purpose");
    return signals.findForUser(currentUser.requiredUser().id()).stream()
        .filter(
            signal ->
                dimensions
                    .findActive(signal.dimensionCode())
                    .map(
                        definition ->
                            definition.sensitivity()
                                == PreferenceDimensionCatalog.Sensitivity.STANDARD)
                    .orElse(false))
        .map(PreferenceResponse::from)
        .toList();
  }
}
