package fu.tripsense.contextservice.adapter.in.web;

import fu.tripsense.contextservice.domain.PlaceIntent;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.Map;
import java.util.Set;

public record UpdateOnboardingRequest(
    @PositiveOrZero long version,
    @NotNull Map<String, Set<String>> selections,
    @NotNull Map<PlaceIntent, Set<String>> places,
    Map<String, String> attributes,
    @Size(max = 2000) String freeText) {

  public UpdateOnboardingRequest(
      long version,
      Map<String, Set<String>> selections,
      Map<PlaceIntent, Set<String>> places) {
    this(version, selections, places, Map.of(), null);
  }
}
