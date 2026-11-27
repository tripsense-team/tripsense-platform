package fu.tripsense.placeservice.client;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RecommendationIndexerClientTest {

  @Test
  @DisplayName("Should handle null or empty places without error")
  void shouldHandleNullOrEmpty() {
    TripSensePlaceProperties properties = new TripSensePlaceProperties();
    RecommendationIndexerClient client = new RecommendationIndexerClient(properties);

    assertDoesNotThrow(() -> client.index(null));
    assertDoesNotThrow(() -> client.index(List.of()));
    assertDoesNotThrow(() -> client.delete(null));
    assertDoesNotThrow(() -> client.delete(""));
  }
}
