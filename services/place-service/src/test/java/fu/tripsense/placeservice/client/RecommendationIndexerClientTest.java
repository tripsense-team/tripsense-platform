package fu.tripsense.placeservice.client;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.dto.LocationDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RecommendationIndexerClientTest {

  @Test
  @DisplayName("Should handle null or empty places without error")
  void shouldHandleNullOrEmpty() {
    TripSensePlaceProperties properties = new TripSensePlaceProperties();
    RecommendationIndexerClient client = new RecommendationIndexerClient(properties);

    assertDoesNotThrow(() -> client.triggerIndexingAsync(null));
    assertDoesNotThrow(() -> client.triggerIndexingAsync(List.of()));
  }

  @Test
  @DisplayName(
      "Should swallow exception gracefully when downstream recommendation-service is unreachable")
  void shouldSwallowExceptionGracefully() {
    TripSensePlaceProperties properties = new TripSensePlaceProperties();
    properties.setRecommendationServiceUrl("http://localhost:9999"); // unreachable port

    RecommendationIndexerClient client = new RecommendationIndexerClient(properties);

    PlaceDto place =
        PlaceDto.builder()
            .id("p1")
            .name("Test Place")
            .location(new LocationDto(16.05, 108.20))
            .categories(List.of("cafe"))
            .build();

    assertDoesNotThrow(() -> client.triggerIndexingAsync(List.of(place)));
  }
}
