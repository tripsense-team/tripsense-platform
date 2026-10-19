package fu.tripsense.recommendation.adapter.out.http;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import fu.tripsense.recommendation.application.RequestDiagnostics;
import fu.tripsense.recommendation.application.port.PlaceSnapshotResolver;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Slf4j
@Component
public class CanonicalPlaceClient implements PlaceSnapshotResolver {
  private final RestClient restClient;
  private final String baseUrl;

  public CanonicalPlaceClient(
      RestClient recommendationRestClient, RecommendationProperties properties) {
    this.restClient = recommendationRestClient;
    this.baseUrl = properties.getDownstream().getPlaceUrl();
  }

  @Override
  public Optional<PlaceSnapshot> find(String placeId) {
    try {
      DetailEnvelope response =
          RequestDiagnostics.measure(
              "snapshot_individual",
              () ->
                  restClient
                      .get()
                      .uri(baseUrl + "/api/places/{placeId}", placeId)
                      .retrieve()
                      .body(DetailEnvelope.class));
      RequestDiagnostics.mark(
          "snapshot_individual_found",
          response != null && response.success() && response.data() != null);
      return response == null || !response.success() || response.data() == null
          ? Optional.empty()
          : Optional.of(response.data().toDomain());
    } catch (RuntimeException exception) {
      return Optional.empty();
    }
  }

  @Override
  public Map<String, PlaceSnapshot> resolveBatch(List<String> placeIds) {
    return resolveBatch(placeIds, true);
  }

  @Override
  public Map<String, PlaceSnapshot> resolveLocalBatch(List<String> placeIds) {
    return resolveBatch(placeIds, false);
  }

  private Map<String, PlaceSnapshot> resolveBatch(
      List<String> placeIds, boolean allowDetailFallback) {
    if (placeIds == null || placeIds.isEmpty()) {
      return Map.of();
    }
    try {
      BatchEnvelope response =
          RequestDiagnostics.measure(
              "snapshot_batch_http",
              () ->
                  restClient
                      .post()
                      .uri(baseUrl + "/api/places/batch-snapshots")
                      .body(placeIds)
                      .retrieve()
                      .body(BatchEnvelope.class));
      if (response != null && response.success() && response.data() != null) {
        Map<String, PlaceSnapshot> result = new HashMap<>();
        for (PlaceServiceCandidateGenerator.PlaceDto dto : response.data()) {
          PlaceSnapshot snapshot = dto.toDomain();
          if (dto.id() != null) {
            result.put(dto.id(), snapshot);
          }
          if (dto.providerPlaceId() != null) {
            result.put(dto.providerPlaceId(), snapshot);
          }
        }
        return result;
      }
    } catch (RuntimeException exception) {
      RequestDiagnostics.mark("snapshot_batch_http_error", true);
      log.warn(
          "snapshot_batch_failed requestId={} errorType={}",
          RequestDiagnostics.requestId(),
          exception.getClass().getSimpleName());
    }
    if (!allowDetailFallback) return Map.of();
    RequestDiagnostics.mark("snapshot_batch_fallback_calls", placeIds.size());
    return RequestDiagnostics.measure(
        "snapshot_batch_fallback", () -> PlaceSnapshotResolver.super.resolveBatch(placeIds));
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  record DetailEnvelope(boolean success, PlaceServiceCandidateGenerator.PlaceDto data) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record BatchEnvelope(boolean success, List<PlaceServiceCandidateGenerator.PlaceDto> data) {}
}
