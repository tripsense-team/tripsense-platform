package fu.tripsense.placeservice.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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

  RecommendationIndexerClient(TripSensePlaceProperties properties, RestClient restClient) {
    this.properties = properties;
    this.restClient = restClient;
  }

  private static RestClient createDefaultRestClient() {
    SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
    requestFactory.setConnectTimeout(Duration.ofSeconds(5));
    requestFactory.setReadTimeout(Duration.ofSeconds(60));
    return RestClient.builder().requestFactory(requestFactory).build();
  }

  private static final int INDEX_BATCH_SIZE = 25;

  public record IndexBatchOutcome(
      int submitted, int batchesSucceeded, int batchesFailed, String errorReason) {
    public boolean isFullySynced() {
      return batchesFailed == 0;
    }
  }

  public IndexBatchOutcome triggerIndexingBatchSync(List<PlaceDto> places) {
    if (places == null || places.isEmpty()) {
      return new IndexBatchOutcome(0, 0, 0, null);
    }
    List<PlaceIndexingPayload> payloads =
        places.stream().filter(Objects::nonNull).map(PlaceIndexingPayload::from).toList();
    if (payloads.isEmpty()) {
      return new IndexBatchOutcome(0, 0, 0, null);
    }

    String baseUrl = properties.getRecommendationServiceUrl();
    if (baseUrl == null || baseUrl.isBlank()) {
      baseUrl = "http://localhost:8088";
    }

    int succeeded = 0;
    int failed = 0;
    String lastError = null;

    for (int i = 0; i < payloads.size(); i += INDEX_BATCH_SIZE) {
      int end = Math.min(i + INDEX_BATCH_SIZE, payloads.size());
      List<PlaceIndexingPayload> batch = payloads.subList(i, end);
      try {
        restClient
            .post()
            .uri(baseUrl + "/api/recommendations/internal/places/index")
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .header("X-Internal-Api-Key", properties.getRecommendationInternalApiKey())
            .body(batch)
            .retrieve()
            .toBodilessEntity();
        succeeded++;
      } catch (Exception exception) {
        failed++;
        lastError = exception.getClass().getSimpleName();
        log.warn(
            "Batch recommendation indexing failed for batch [{}-{}): errorType={}, message={}",
            i,
            end,
            lastError,
            exception.getMessage());
      }
    }

    return new IndexBatchOutcome(payloads.size(), succeeded, failed, lastError);
  }

  public void triggerIndexingAsync(List<PlaceDto> places) {
    if (places == null || places.isEmpty()) {
      return;
    }
    CompletableFuture.runAsync(
        () -> {
          try {
            List<PlaceIndexingPayload> payloads =
                places.stream().filter(Objects::nonNull).map(PlaceIndexingPayload::from).toList();
            index(payloads);
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
            delete(placeId);
            log.info("Triggered async recommendation de-indexing for placeId={}", placeId);
          } catch (Exception exception) {
            log.warn(
                "Async recommendation de-indexing notification failed: errorType={}",
                exception.getClass().getSimpleName());
          }
        });
  }

  public IndexBatchResult index(List<PlaceIndexingPayload> places) {
    if (places == null || places.isEmpty()) return new IndexBatchResult(List.of());
    IndexEnvelope response =
        restClient
            .post()
            .uri(baseUrl() + "/api/recommendations/internal/places/index")
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .header("X-Internal-Api-Key", properties.getRecommendationInternalApiKey())
            .body(places)
            .retrieve()
            .body(IndexEnvelope.class);
    if (response == null || !response.success() || response.data() == null) {
      throw new IllegalStateException("Recommendation indexing response was unavailable");
    }
    return new IndexBatchResult(response.data().results());
  }

  public void delete(String placeId) {
    if (placeId == null || placeId.isBlank()) return;
    restClient
        .delete()
        .uri(baseUrl() + "/api/recommendations/internal/places/{placeId}", placeId)
        .header("X-Internal-Api-Key", properties.getRecommendationInternalApiKey())
        .retrieve()
        .toBodilessEntity();
  }

  private String baseUrl() {
    String value = properties.getRecommendationServiceUrl();
    if (value == null || value.isBlank()) {
      throw new IllegalStateException("Recommendation service URL is not configured");
    }
    return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
  }

  public record IndexBatchResult(List<ItemResult> results) {
    public IndexBatchResult {
      results = results == null ? List.of() : List.copyOf(results);
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  record IndexEnvelope(boolean success, IndexData data) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record IndexData(List<ItemResult> results) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ItemResult(
      String placeId, Long sourceVersion, Status status, String errorCode) {}

  public enum Status {
    INDEXED,
    UNCHANGED,
    RETRYABLE_FAILURE,
    PERMANENT_FAILURE
  }
}
