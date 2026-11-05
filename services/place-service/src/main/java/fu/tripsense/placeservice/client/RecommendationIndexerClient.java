package fu.tripsense.placeservice.client;

import fu.tripsense.placeservice.client.dto.PlaceIndexingPayload;
import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.dto.PlaceDto;
import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Slf4j
@Component
public class RecommendationIndexerClient {
  private final RestClient restClient;
  private final TripSensePlaceProperties properties;

  @Autowired
  public RecommendationIndexerClient(TripSensePlaceProperties properties) {
    this(properties, createDefaultRestClient());
  }

  RecommendationIndexerClient(
      TripSensePlaceProperties properties, RestClient restClient) {
    this.properties = properties;
    this.restClient = restClient;
  }

  private static RestClient createDefaultRestClient() {
    SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
    requestFactory.setConnectTimeout(Duration.ofSeconds(10));
    requestFactory.setReadTimeout(Duration.ofSeconds(60));
    return RestClient.builder().requestFactory(requestFactory).build();
  }

  public void triggerIndexingAsync(List<PlaceDto> places) {
    if (places == null || places.isEmpty()) {
      return;
    }
    CompletableFuture.runAsync(
        () -> {
          try {
            String baseUrl = properties.getRecommendationServiceUrl();
            if (baseUrl == null || baseUrl.isBlank()) {
              baseUrl = "http://localhost:8088";
            }
            List<PlaceIndexingPayload> payloads =
                places.stream().filter(Objects::nonNull).map(PlaceIndexingPayload::from).toList();

            restClient
                .post()
                .uri(baseUrl + "/api/recommendations/internal/places/index")
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("X-Internal-Api-Key", properties.getRecommendationInternalApiKey())
                .body(payloads)
                .retrieve()
                .toBodilessEntity();

            log.info("Triggered async recommendation indexing for {} places", payloads.size());
          } catch (Exception exception) {
            log.warn(
                "Async recommendation indexing notification failed: errorType={}, message={}",
                exception.getClass().getSimpleName(),
                exception.getMessage());
          }
        });
  }

  public void triggerDeindexingAsync(String placeId) {
    if (placeId == null || placeId.isBlank()) return;
    CompletableFuture.runAsync(
        () -> {
          try {
            String baseUrl = properties.getRecommendationServiceUrl();
            if (baseUrl == null || baseUrl.isBlank()) baseUrl = "http://localhost:8088";
            restClient
                .delete()
                .uri(baseUrl + "/api/recommendations/internal/places/{placeId}", placeId)
                .header("X-Internal-Api-Key", properties.getRecommendationInternalApiKey())
                .retrieve()
                .toBodilessEntity();
            log.info("Triggered async recommendation de-indexing for placeId={}", placeId);
          } catch (Exception exception) {
            log.warn(
                "Async recommendation de-indexing notification failed: errorType={}",
                exception.getClass().getSimpleName());
          }
        });
  }
}
