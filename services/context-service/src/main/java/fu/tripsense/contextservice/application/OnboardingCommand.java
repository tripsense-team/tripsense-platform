package fu.tripsense.contextservice.application;

import fu.tripsense.contextservice.domain.PlaceIntent;
import java.util.Map;
import java.util.Set;

public record OnboardingCommand(
    long version,
    Map<String, Set<String>> selections,
    Map<PlaceIntent, Set<String>> places,
    Map<String, String> attributes,
    String freeText) {

  public OnboardingCommand(
      long version,
      Map<String, Set<String>> selections,
      Map<PlaceIntent, Set<String>> places) {
    this(version, selections, places, Map.of(), null);
  }
}
