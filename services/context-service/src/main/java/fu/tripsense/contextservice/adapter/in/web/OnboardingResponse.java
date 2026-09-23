package fu.tripsense.contextservice.adapter.in.web;

import fu.tripsense.contextservice.domain.OnboardingProfile;
import fu.tripsense.contextservice.domain.PlaceIntent;
import java.time.Instant;
import java.util.Map;
import java.util.Set;

public record OnboardingResponse(
    long version,
    String status,
    int schemaVersion,
    Instant completedAt,
    Instant updatedAt,
    Map<String, Set<String>> selections,
    Map<PlaceIntent, Set<String>> places,
    Map<String, String> attributes,
    String freeText) {
  static OnboardingResponse from(OnboardingProfile profile) {
    return new OnboardingResponse(
        profile.version(),
        profile.status().name(),
        profile.schemaVersion(),
        profile.completedAt(),
        profile.updatedAt(),
        profile.selections(),
        profile.places(),
        profile.attributes(),
        profile.freeText());
  }
}
