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
import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import fu.tripsense.placeservice.service.ApiKeyPoolService;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Slf4j
@Component
public class RecommendationIndexerClient {
  private final RestClient restClient;
  private final TripSensePlaceProperties properties;
  private final ApiKeyPoolService apiKeyPoolService;

  public RecommendationIndexerClient(TripSensePlaceProperties properties) {
    this(properties, createDefaultRestClient(), null);
  }

  @Autowired
  public RecommendationIndexerClient(
      TripSensePlaceProperties properties,
      @Autowired(required = false) RestClient restClient,
      @Autowired(required = false) ApiKeyPoolService apiKeyPoolService) {
    this.properties = properties;
    this.restClient = restClient != null ? restClient : createDefaultRestClient();
    this.apiKeyPoolService = apiKeyPoolService;
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
    CompletableFuture.runAsync(() -> {
      try {
        String baseUrl = properties.getRecommendationServiceUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
          baseUrl = "http://localhost:8088";
        }
        List<PlaceIndexingPayload> payloads =
            places.stream()
                .filter(Objects::nonNull)
                .map(PlaceIndexingPayload::from)
                .toList();

        String activeGeminiKey =
            apiKeyPoolService != null ? apiKeyPoolService.getActiveKey(ApiKeyProvider.GEMINI) : null;

        var requestSpec = restClient
            .post()
            .uri(baseUrl + "/api/recommendations/internal/places/index")
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .header("X-Internal-Api-Key", properties.getRecommendationInternalApiKey());

        if (activeGeminiKey != null && !activeGeminiKey.isBlank()) {
          requestSpec.header("X-Gemini-Api-Key", activeGeminiKey);
        }

        requestSpec
            .body(payloads)
            .retrieve()
            .toBodilessEntity();

        if (apiKeyPoolService != null && activeGeminiKey != null) {
          apiKeyPoolService.recordSuccess(ApiKeyProvider.GEMINI, activeGeminiKey);
        }
        log.info("Triggered async recommendation indexing for {} places", payloads.size());
      } catch (Exception exception) {
        String msg = exception.getMessage() != null ? exception.getMessage().toLowerCase() : "";
        if (msg.contains("429") || msg.contains("quota") || msg.contains("resource_exhausted")) {
          if (apiKeyPoolService != null) {
            String activeKey = apiKeyPoolService.getActiveKey(ApiKeyProvider.GEMINI);
            var nextKey = apiKeyPoolService.markExhaustedAndRotate(
                ApiKeyProvider.GEMINI, activeKey, exception.getMessage());
            if (nextKey.isPresent()) {
              log.info("[RecommendationIndexer] Gemini key exhausted. Auto-rotated to: {}", nextKey.get().getMaskedKey());
            }
          }
        }
        log.warn(
            "Async recommendation indexing notification failed: errorType={}, message={}",
            exception.getClass().getSimpleName(),
            exception.getMessage());
      }
    });
  }
}
