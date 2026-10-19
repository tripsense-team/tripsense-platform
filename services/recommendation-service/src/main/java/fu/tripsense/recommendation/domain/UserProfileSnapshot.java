package fu.tripsense.recommendation.domain;

import java.time.Instant;
import java.util.Map;
import java.util.Set;

public record UserProfileSnapshot(
    boolean available,
    boolean personalizationEnabled,
    Set<String> preferredCategories,
    Set<String> dislikedCategories,
    Map<String, Double> categoryAffinities,
    Set<String> seenPlaceIds,
    Set<String> savedPlaceIds,
    Set<String> addedToTripPlaceIds,
    Set<String> negativePlaceIds,
    Instant updatedAt) {
  public UserProfileSnapshot {
    preferredCategories = preferredCategories == null ? Set.of() : Set.copyOf(preferredCategories);
    dislikedCategories = dislikedCategories == null ? Set.of() : Set.copyOf(dislikedCategories);
    categoryAffinities = categoryAffinities == null ? Map.of() : Map.copyOf(categoryAffinities);
    seenPlaceIds = seenPlaceIds == null ? Set.of() : Set.copyOf(seenPlaceIds);
    savedPlaceIds = savedPlaceIds == null ? Set.of() : Set.copyOf(savedPlaceIds);
    addedToTripPlaceIds = addedToTripPlaceIds == null ? Set.of() : Set.copyOf(addedToTripPlaceIds);
    negativePlaceIds = negativePlaceIds == null ? Set.of() : Set.copyOf(negativePlaceIds);
  }

  public static UserProfileSnapshot coldStart(boolean personalizationEnabled) {
    return new UserProfileSnapshot(
        false,
        personalizationEnabled,
        Set.of(),
        Set.of(),
        Map.of(),
        Set.of(),
        Set.of(),
        Set.of(),
        Set.of(),
        null);
  }

  /** Count effective category/history signals, not the success of a Context HTTP request. */
  public int personalizationSignalCount() {
    return personalizationSignalCount(true);
  }

  public int personalizationSignalCount(boolean includePassiveSeen) {
    var categories = new java.util.HashSet<>(preferredCategories);
    categories.addAll(dislikedCategories);
    categoryAffinities.forEach(
        (category, weight) -> {
          if (Double.isFinite(weight) && weight != 0) categories.add(category);
        });
    var places = new java.util.HashSet<String>();
    if (includePassiveSeen) places.addAll(seenPlaceIds);
    places.addAll(savedPlaceIds);
    places.addAll(addedToTripPlaceIds);
    places.addAll(negativePlaceIds);
    return categories.size() + places.size();
  }
}
