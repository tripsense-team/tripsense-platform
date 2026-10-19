package fu.tripsense.recommendation.algorithm.profile;

import static fu.tripsense.recommendation.domain.FeedbackEventType.*;
import static org.assertj.core.api.Assertions.*;

import fu.tripsense.recommendation.algorithm.feature.TemporalDecayCalculator;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.FeedbackEventType;
import fu.tripsense.recommendation.domain.UserProfileSnapshot;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class ObservedSignalReducerTest {
  private static final Instant NOW = Instant.parse("2026-10-19T00:00:00Z");
  private final UUID trip = UUID.randomUUID();
  private final RecommendationProperties properties = new RecommendationProperties();

  private ObservedSignalReducer reducer() {
    return new ObservedSignalReducer(
        properties,
        new InteractionWeightCalculator(properties, new TemporalDecayCalculator()),
        new MultiTimescaleProfileComposer(properties));
  }

  private ObservedSignalReducer.Event event(int sequence, String place, FeedbackEventType type) {
    return new ObservedSignalReducer.Event(
        new UUID(0, sequence), place, type, NOW, trip, "session", List.of("cafe"));
  }

  private UserProfileSnapshot reduce(List<ObservedSignalReducer.Event> events) {
    return reducer().reduce(events, Set.of(), trip, "session", NOW);
  }

  @Test
  void exposuresAreSeenButNeverPreferenceOrNegativeOpinion() {
    var profile = reduce(IntStream.range(1, 11).mapToObj(i -> event(i, "a", IMPRESSION)).toList());
    assertThat(profile.seenPlaceIds()).containsExactly("a");
    assertThat(profile.categoryAffinities()).isEmpty();
    assertThat(profile.negativePlaceIds()).isEmpty();
    assertThat(profile.personalizationSignalCount(false)).isZero();
  }

  @Test
  void oneClickIsWeakEvenWhenPresentInAllThreeSegments() {
    assertThat(reduce(List.of(event(1, "a", CLICK))).categoryAffinities().get("cafe"))
        .isCloseTo(0.3 / 3.3, within(1e-12));
  }

  @Test
  void hundredRepeatedClicksHaveSameEffectAsOneAtSameTime() {
    var one = reduce(List.of(event(1, "a", CLICK)));
    var repeated = reduce(IntStream.range(1, 101).mapToObj(i -> event(i, "a", CLICK)).toList());
    assertThat(repeated.categoryAffinities()).isEqualTo(one.categoryAffinities());
  }

  @Test
  void strongestSignalWinsInsteadOfStackingClicksDetailsAndSave() {
    assertThat(
            reduce(List.of(event(1, "a", CLICK), event(2, "a", DETAIL_VIEW), event(3, "a", SAVE)))
                .categoryAffinities())
        .isEqualTo(reduce(List.of(event(3, "a", SAVE))).categoryAffinities());
  }

  @Test
  void differentPlacesIncreaseEvidenceButTotalMassIsCapped() {
    var one = reduce(List.of(event(1, "a", SAVE)));
    var many = reduce(IntStream.range(1, 101).mapToObj(i -> event(i, "p" + i, SAVE)).toList());
    assertThat(many.categoryAffinities().get("cafe"))
        .isGreaterThan(one.categoryAffinities().get("cafe"))
        .isEqualTo(0.5);
  }

  @Test
  void unsaveRevokesPositiveStateButDoesNotCreateCategoryDislike() {
    var profile = reduce(List.of(event(1, "a", SAVE), event(2, "a", UNSAVE)));
    assertThat(profile.savedPlaceIds()).isEmpty();
    assertThat(profile.categoryAffinities()).isEmpty();
    assertThat(profile.negativePlaceIds()).isEmpty();
    assertThat(
            reduce(List.of(event(1, "a", SAVE), event(2, "a", UNSAVE), event(3, "a", SAVE)))
                .categoryAffinities())
        .isEqualTo(reduce(List.of(event(3, "a", SAVE))).categoryAffinities());
  }

  @Test
  void removingTripRevokesOnlyTripSignalAndReAddWorks() {
    assertThat(
            reduce(List.of(event(1, "a", ADD_TO_TRIP), event(2, "a", REMOVE_FROM_TRIP)))
                .categoryAffinities())
        .isEmpty();
    var restored =
        reduce(
            List.of(
                event(1, "a", ADD_TO_TRIP),
                event(2, "a", REMOVE_FROM_TRIP),
                event(3, "a", ADD_TO_TRIP)));
    assertThat(restored.addedToTripPlaceIds()).containsExactly("a");
    assertThat(restored.categoryAffinities().get("cafe")).isCloseTo(0.25, within(1e-12));
  }

  @Test
  void revocationInAnotherSessionAndTripDoesNotResurrectSegmentState() {
    var revoke =
        new ObservedSignalReducer.Event(
            new UUID(0, 2), "a", UNSAVE, NOW, UUID.randomUUID(), "other", List.of("cafe"));
    assertThat(reduce(List.of(event(1, "a", SAVE), revoke)).categoryAffinities()).isEmpty();
    var reSave =
        new ObservedSignalReducer.Event(
            new UUID(0, 3), "a", SAVE, NOW, UUID.randomUUID(), "other", List.of("restaurant"));
    assertThat(reduce(List.of(event(1, "a", SAVE), revoke, reSave)).categoryAffinities())
        .containsOnlyKeys("restaurant");
  }

  @Test
  void revokedSaveCanStillHaveEarlierGenuineClickInterest() {
    assertThat(
            reduce(List.of(event(1, "a", CLICK), event(2, "a", SAVE), event(3, "a", UNSAVE)))
                .categoryAffinities())
        .isEqualTo(reduce(List.of(event(1, "a", CLICK))).categoryAffinities());
  }

  @Test
  void dislikeSuppressesExactPlaceNotOtherCafeAndLikeClearsIt() {
    var profile =
        reduce(List.of(event(1, "a", SAVE), event(2, "a", DISLIKE), event(3, "b", CLICK)));
    assertThat(profile.negativePlaceIds()).containsExactly("a");
    assertThat(profile.categoryAffinities())
        .isEqualTo(reduce(List.of(event(3, "b", CLICK))).categoryAffinities());
    assertThat(
            reduce(List.of(event(1, "a", SAVE), event(2, "a", DISLIKE), event(3, "a", CLICK)))
                .categoryAffinities())
        .isEmpty();
    var liked = reduce(List.of(event(1, "a", DISLIKE), event(2, "a", LIKE)));
    assertThat(liked.negativePlaceIds()).isEmpty();
    assertThat(liked.categoryAffinities().get("cafe")).isPositive();
  }

  @Test
  void manyCategoriesShareOneVoteAndDuplicatesDoNotMultiplyMass() {
    var e =
        new ObservedSignalReducer.Event(
            new UUID(0, 1),
            "a",
            CLICK,
            NOW,
            trip,
            "session",
            List.of("CAFE", "cafe", " restaurant ", ""));
    var result = reduce(List.of(e)).categoryAffinities();
    assertThat(result).containsOnlyKeys("cafe", "restaurant");
    assertThat(result.get("cafe")).isCloseTo(0.3 / 3.3 / 2, within(1e-12));
    assertThat(result.values().stream().mapToDouble(Double::doubleValue).sum())
        .isCloseTo(0.3 / 3.3, within(1e-12));
  }

  @Test
  void noCategoriesAreNotEvidenceAndEmptyHistoryIsCold() {
    var e =
        new ObservedSignalReducer.Event(new UUID(0, 1), "a", SAVE, NOW, trip, "session", List.of());
    assertThat(reduce(List.of(e)).categoryAffinities()).isEmpty();
    assertThat(reduce(List.of()).available()).isFalse();
  }

  @Test
  void oldEvidenceDecaysAndFreshRepeatRefreshesRecencyWithoutStacking() {
    var old =
        new ObservedSignalReducer.Event(
            new UUID(0, 1),
            "a",
            CLICK,
            NOW.minus(100, ChronoUnit.DAYS),
            trip,
            "session",
            List.of("cafe"));
    double oldScore = reduce(List.of(old)).categoryAffinities().get("cafe");
    double freshScore = reduce(List.of(event(2, "a", CLICK))).categoryAffinities().get("cafe");
    assertThat(oldScore).isLessThan(freshScore);
    assertThat(reduce(List.of(old, event(2, "a", CLICK))).categoryAffinities().get("cafe"))
        .isEqualTo(freshScore);
  }

  @Test
  void equalTimestampOrderUsesPostgresCompatibleUuidOrderRegardlessOfInput() {
    var save = event(1, "a", SAVE);
    var unsave = event(2, "a", UNSAVE);
    assertThat(reduce(List.of(unsave, save)).savedPlaceIds()).isEmpty();
    assertThat(reduce(List.of(unsave, save)).categoryAffinities())
        .isEqualTo(reduce(List.of(save, unsave)).categoryAffinities());
  }

  @Test
  void boundedFiveThousandEventWindowRemainsFiniteAndPassiveRowsDoNotBecomeEvidence() {
    var events = new ArrayList<ObservedSignalReducer.Event>();
    IntStream.range(1, 5000).forEach(i -> events.add(event(i, "p" + i, IMPRESSION)));
    events.add(event(5000, "a", CLICK));
    var profile = reduce(events);
    assertThat(profile.seenPlaceIds()).hasSize(5000);
    assertThat(profile.categoryAffinities())
        .isEqualTo(reduce(List.of(event(5000, "a", CLICK))).categoryAffinities());
  }

  @Test
  void settingsAreFiniteBoundedAndZeroInfluenceDisablesLearnedAffinity() {
    for (double invalid : new double[] {0, -1, Double.NaN, Double.POSITIVE_INFINITY}) {
      properties.getProfile().setObservedConfidencePrior(invalid);
      assertThatThrownBy(this::reducer).isInstanceOf(IllegalArgumentException.class);
    }
    properties.getProfile().setObservedConfidencePrior(3);
    for (double invalid : new double[] {-1, 1.1, Double.NaN, Double.POSITIVE_INFINITY}) {
      properties.getProfile().setObservedMaxInfluence(invalid);
      assertThatThrownBy(this::reducer).isInstanceOf(IllegalArgumentException.class);
    }
    properties.getProfile().setObservedMaxInfluence(0);
    assertThat(reduce(List.of(event(1, "a", CLICK))).categoryAffinities()).isEmpty();
  }
}
