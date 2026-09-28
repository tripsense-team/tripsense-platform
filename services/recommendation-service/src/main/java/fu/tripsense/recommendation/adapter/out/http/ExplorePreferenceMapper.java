package fu.tripsense.recommendation.adapter.out.http;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Maps purpose-scoped Context codes to the canonical Place taxonomy used by ranking. */
@Component
public class ExplorePreferenceMapper {
  private static final Map<String, List<Affinity>> MAPPINGS =
      Map.ofEntries(
          Map.entry("CAFE", List.of(new Affinity("cafe", 1.0))),
          Map.entry(
              "LOCAL_FOOD",
              List.of(new Affinity("restaurant", 1.0), new Affinity("local_food", 0.8))),
          Map.entry(
              "STREET_FOOD",
              List.of(new Affinity("restaurant", 1.0), new Affinity("street_food", 0.9))),
          Map.entry(
              "FINE_DINING",
              List.of(new Affinity("restaurant", 1.0), new Affinity("fine_dining", 0.9))),
          Map.entry("HOTEL", List.of(new Affinity("hotel", 1.0), new Affinity("lodging", 0.8))),
          Map.entry(
              "HOMESTAY", List.of(new Affinity("homestay", 1.0), new Affinity("lodging", 0.8))),
          Map.entry("HOSTEL", List.of(new Affinity("hostel", 1.0), new Affinity("lodging", 0.8))),
          Map.entry("RESORT", List.of(new Affinity("resort", 1.0), new Affinity("lodging", 0.8))),
          Map.entry(
              "NATURE", List.of(new Affinity("nature", 1.0), new Affinity("attraction", 0.7))),
          Map.entry(
              "HIKING", List.of(new Affinity("hiking", 1.0), new Affinity("attraction", 0.7))),
          Map.entry(
              "CULTURE", List.of(new Affinity("culture", 1.0), new Affinity("attraction", 0.7))),
          Map.entry("BEACH", List.of(new Affinity("beach", 1.0), new Affinity("attraction", 0.7))),
          Map.entry(
              "NIGHTLIFE",
              List.of(new Affinity("nightlife", 1.0), new Affinity("attraction", 0.5))));

  public Map<String, Double> map(String dimensionCode, String valueCode, double confidence) {
    if (dimensionCode == null || valueCode == null || !supportedDimension(dimensionCode)) {
      return Map.of();
    }
    double boundedConfidence = Math.max(0, Math.min(1, confidence));
    Map<String, Double> result = new LinkedHashMap<>();
    for (Affinity affinity :
        MAPPINGS.getOrDefault(valueCode.trim().toUpperCase(Locale.ROOT), List.of())) {
      result.put(affinity.category(), boundedConfidence * affinity.weight());
    }
    return Map.copyOf(result);
  }

  private boolean supportedDimension(String value) {
    return switch (value.trim().toUpperCase(Locale.ROOT)) {
      case "FOOD_STYLE",
          "ACTIVITY_INTEREST",
          "STAY_STYLE",
          "SPLURGE_CATEGORY",
          "EXPLORE_AFFINITY" ->
          true;
      default -> false;
    };
  }

  private record Affinity(String category, double weight) {}
}
