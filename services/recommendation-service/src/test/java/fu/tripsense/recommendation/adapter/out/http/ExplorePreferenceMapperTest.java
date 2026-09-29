package fu.tripsense.recommendation.adapter.out.http;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ExplorePreferenceMapperTest {
  private final ExplorePreferenceMapper mapper = new ExplorePreferenceMapper();

  @Test
  void mapsContextCodesToCanonicalWeightedAffinities() {
    assertThat(mapper.map("FOOD_STYLE", "LOCAL_FOOD", 0.8)).containsEntry("restaurant", 0.8);
    assertThat(mapper.map("FOOD_STYLE", "LOCAL_FOOD", 0.8).get("local_food"))
        .isCloseTo(0.64, org.assertj.core.data.Offset.offset(0.000001));
    assertThat(mapper.map("ACTIVITY_INTEREST", "BEACH", 1.0))
        .containsEntry("beach", 1.0)
        .containsEntry("attraction", 0.7);
  }

  @Test
  void rejectsUnsupportedDimensionsAndBoundsConfidence() {
    assertThat(mapper.map("LOYALTY_PROGRAM", "CAFE", 1.0)).isEmpty();
    assertThat(mapper.map("EXPLORE_AFFINITY", "CAFE", 2.0)).containsEntry("cafe", 1.0);
  }
}
