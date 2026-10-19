package fu.tripsense.recommendation.algorithm.profile;

import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.FeedbackEventType;
import fu.tripsense.recommendation.domain.UserProfileSnapshot;
import java.time.Instant;
import java.util.*;
import java.util.function.Predicate;

/** Bounded input, deterministic intent derivation. Raw feedback is never rewritten. */
public final class ObservedSignalReducer {
  public record Event(
      UUID id,
      String placeId,
      FeedbackEventType type,
      Instant at,
      UUID tripId,
      String sessionId,
      List<String> categories) {
    public Event {
      categories = List.copyOf(categories);
    }
  }

  private final RecommendationProperties.Profile settings;
  private final InteractionWeightCalculator weights;
  private final MultiTimescaleProfileComposer composer;

  public ObservedSignalReducer(
      RecommendationProperties properties,
      InteractionWeightCalculator weights,
      MultiTimescaleProfileComposer composer) {
    settings = properties.getProfile();
    if (!settings.isObservedSignalSettingsValid())
      throw new IllegalArgumentException("Invalid observed signal settings");
    this.weights = weights;
    this.composer = composer;
  }

  public UserProfileSnapshot reduce(
      List<Event> input, Set<String> shown, UUID tripId, String sessionId, Instant now) {
    // UUID string ordering agrees with PostgreSQL's unsigned UUID byte ordering.
    List<Event> events =
        input.stream()
            .sorted(Comparator.comparing(Event::at).thenComparing(event -> event.id().toString()))
            .toList();
    Set<String> seen = new HashSet<>(shown);
    Set<String> saved = new HashSet<>(), added = new HashSet<>(), negative = new HashSet<>();
    Map<String, UUID> latestSave = new HashMap<>(), latestAdd = new HashMap<>();
    for (Event event : events) {
      switch (event.type()) {
        case IMPRESSION, CLICK, DETAIL_VIEW, BOOKING_CLICK -> seen.add(event.placeId());
        case SAVE -> {
          saved.add(event.placeId());
          latestSave.put(event.placeId(), event.id());
        }
        case UNSAVE -> {
          saved.remove(event.placeId());
          latestSave.remove(event.placeId());
        }
        case ADD_TO_TRIP -> {
          added.add(event.placeId());
          latestAdd.put(event.placeId(), event.id());
        }
        case REMOVE_FROM_TRIP -> {
          added.remove(event.placeId());
          latestAdd.remove(event.placeId());
        }
        case DISLIKE -> negative.add(event.placeId());
        case LIKE -> negative.remove(event.placeId());
      }
    }
    Predicate<Event> eligible =
        event ->
            !negative.contains(event.placeId())
                && switch (event.type()) {
                  case CLICK, BOOKING_CLICK, DETAIL_VIEW, LIKE -> true;
                  case SAVE -> event.id().equals(latestSave.get(event.placeId()));
                  case ADD_TO_TRIP -> event.id().equals(latestAdd.get(event.placeId()));
                  default -> false;
                };
    List<Event> intentional = events.stream().filter(eligible).toList();
    Map<String, Double> affinities =
        composer.compose(
            segment(intentional, event -> true, now),
            segment(intentional, event -> tripId != null && tripId.equals(event.tripId()), now),
            segment(
                intentional,
                event -> sessionId != null && sessionId.equals(event.sessionId()),
                now));
    boolean available =
        !seen.isEmpty()
            || !saved.isEmpty()
            || !added.isEmpty()
            || !negative.isEmpty()
            || !affinities.isEmpty();
    return new UserProfileSnapshot(
        available,
        true,
        Set.of(),
        Set.of(),
        affinities,
        seen,
        saved,
        added,
        negative,
        available ? now : null);
  }

  private record Evidence(double strength, List<String> categories) {}

  private ProfileSegment segment(List<Event> events, Predicate<Event> scope, Instant now) {
    Map<String, Evidence> perPlace = new HashMap<>();
    for (Event event : events) {
      if (!scope.test(event)) continue;
      List<String> categories =
          event.categories().stream()
              .map(value -> value.trim().toLowerCase(Locale.ROOT))
              .filter(value -> !value.isBlank())
              .distinct()
              .sorted()
              .toList();
      if (categories.isEmpty()) continue;
      RecommendationProperties.Interaction interaction =
          switch (event.type()) {
            case CLICK, BOOKING_CLICK -> RecommendationProperties.Interaction.CLICK;
            case DETAIL_VIEW -> RecommendationProperties.Interaction.DETAIL_VIEW;
            case LIKE -> RecommendationProperties.Interaction.LIKE;
            case SAVE -> RecommendationProperties.Interaction.SAVE;
            case ADD_TO_TRIP -> RecommendationProperties.Interaction.ADD_TO_TRIP;
            default -> throw new IllegalArgumentException("Unexpected intentional event");
          };
      double strength = weights.weight(interaction, event.at(), now);
      if (!Double.isFinite(strength) || strength <= 0) continue;
      Evidence prior = perPlace.get(event.placeId());
      // Later evidence wins equal strengths; stable event ordering makes ties deterministic.
      if (prior == null || strength >= prior.strength())
        perPlace.put(event.placeId(), new Evidence(strength, categories));
    }
    if (perPlace.isEmpty()) return new ProfileSegment(false, Map.of());
    Map<String, Double> sums = new TreeMap<>();
    double mass = 0;
    // Stable accumulation order, independent of hash iteration / JDBC row order.
    for (String place : perPlace.keySet().stream().sorted().toList()) {
      Evidence evidence = perPlace.get(place);
      mass += Math.min(1, evidence.strength());
      for (String category : evidence.categories())
        sums.merge(category, evidence.strength() / evidence.categories().size(), Double::sum);
    }
    double confidence =
        Math.min(
            settings.getObservedMaxInfluence(),
            mass / (mass + settings.getObservedConfidencePrior()));
    double total = sums.values().stream().mapToDouble(Double::doubleValue).sum();
    if (confidence <= 0 || !Double.isFinite(total) || total <= 0)
      return new ProfileSegment(false, Map.of());
    // L1 normalization keeps total affinity mass <= confidence, including many-tagged places.
    sums.replaceAll((category, sum) -> sum / total * confidence);
    return new ProfileSegment(true, Map.copyOf(sums));
  }
}
