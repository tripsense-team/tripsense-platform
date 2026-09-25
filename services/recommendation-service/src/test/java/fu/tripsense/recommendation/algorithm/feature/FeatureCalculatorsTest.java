package fu.tripsense.recommendation.algorithm.feature;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fu.tripsense.recommendation.domain.GeoPoint;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.assertj.core.data.Offset;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class FeatureCalculatorsTest {
  private final BayesianQualityCalculator bayesian = new BayesianQualityCalculator();
  private final GeoDistanceCalculator geo = new GeoDistanceCalculator();
  private final PopularityNormalizer popularity = new PopularityNormalizer();
  private final TemporalDecayCalculator temporal = new TemporalDecayCalculator();

  @Test
  void bayesianRatingFallsBackToPriorWhenRatingIsMissingOrHasNoVotes() {
    assertThat(bayesian.weightedRating(null, 12, 4, 20)).isEqualTo(4);
    assertThat(bayesian.weightedRating(5.0, 0, 4, 20)).isEqualTo(4);
  }

  @Test
  void bayesianRatingBalancesObservedRatingAndPrior() {
    assertThat(bayesian.weightedRating(5.0, 20, 4, 20)).isEqualTo(4.5);
  }

  @ParameterizedTest
  @CsvSource({"0,1", "5,0.36787944117144233", "10,0.1353352832366127"})
  void distanceDecayIsDeterministic(double distance, double expected) {
    assertThat(geo.exponentialDecay(distance, 5)).isCloseTo(expected, Offset.offset(1e-12));
  }

  @Test
  void haversineHandlesSamePointAndKnownDistance() {
    assertThat(geo.kilometers(new GeoPoint(10, 106), new GeoPoint(10, 106))).isZero();
    assertThat(geo.kilometers(new GeoPoint(0, 0), new GeoPoint(0, 1)))
        .isCloseTo(111.195, Offset.offset(0.01));
  }

  @Test
  void popularityUsesLogarithmicNormalizationAndHandlesNull() {
    assertThat(popularity.logPopularity(null)).isZero();
    assertThat(popularity.logPopularity(99)).isEqualTo(Math.log(100));
    assertThat(popularity.unitScale(popularity.logPopularity(99))).isBetween(0.0, 1.0);
  }

  @Test
  void temporalDecayUsesEventAgeAndConfiguredLambda() {
    Instant now = Instant.parse("2026-09-24T00:00:00Z");
    assertThat(temporal.decay(1.0, now.minus(10, ChronoUnit.DAYS), now, 0.1))
        .isCloseTo(Math.exp(-1), Offset.offset(1e-12));
  }

  @Test
  void invalidFormulaConfigurationIsRejected() {
    assertThatThrownBy(() -> geo.exponentialDecay(1, 0))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> bayesian.weightedRating(4.0, 2, 4, 0))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
