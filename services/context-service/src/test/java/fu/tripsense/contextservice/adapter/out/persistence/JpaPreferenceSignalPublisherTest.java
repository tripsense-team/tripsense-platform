package fu.tripsense.contextservice.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class JpaPreferenceSignalPublisherTest {
  @Test
  void derivesOnlyAllowlistedExploreAffinitiesFromFreeText() {
    assertThat(
            JpaPreferenceSignalPublisher.deriveExploreAffinities(
                "Tôi thích cà phê yên tĩnh, thiên nhiên và đi biển"))
        .containsEntry("CAFE", 0.70)
        .containsEntry("NATURE", 0.70)
        .containsEntry("BEACH", 0.70)
        .doesNotContainKey("QUIET");
  }

  @Test
  void neverReturnsRawTextAsASignal() {
    String raw = "Thông tin riêng không thuộc taxonomy";
    assertThat(JpaPreferenceSignalPublisher.deriveExploreAffinities(raw)).isEmpty();
  }
}
