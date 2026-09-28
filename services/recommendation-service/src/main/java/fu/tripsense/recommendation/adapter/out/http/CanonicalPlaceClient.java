package fu.tripsense.recommendation.adapter.out.http;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
          restClient
              .get()
              .uri(baseUrl + "/api/places/{placeId}", placeId)
              .retrieve()
              .body(DetailEnvelope.class);
      return response == null || !response.success() || response.data() == null
          ? Optional.empty()
          : Optional.of(response.data().toDomain());
    } catch (RuntimeException exception) {
      return Optional.empty();
    }
  }

  @Override
  public Map<String, PlaceSnapshot> resolveBatch(List<String> placeIds) {
    if (placeIds == null || placeIds.isEmpty()) {
      return Map.of();
    }
    try {
      BatchEnvelope response =
          restClient
              .post()
              .uri(baseUrl + "/api/places/batch-snapshots")
              .body(placeIds)
              .retrieve()
              .body(BatchEnvelope.class);
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
      log.warn("Batch place snapshot resolution failed, falling back: {}", exception.getMessage());
    }
    return PlaceSnapshotResolver.super.resolveBatch(placeIds);
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  record DetailEnvelope(boolean success, PlaceServiceCandidateGenerator.PlaceDto data) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record BatchEnvelope(boolean success, List<PlaceServiceCandidateGenerator.PlaceDto> data) {}
}
