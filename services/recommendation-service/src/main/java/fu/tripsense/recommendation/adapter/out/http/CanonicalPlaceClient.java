package fu.tripsense.recommendation.adapter.out.http;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import fu.tripsense.recommendation.application.port.PlaceSnapshotResolver;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

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

  @JsonIgnoreProperties(ignoreUnknown = true)
  record DetailEnvelope(boolean success, PlaceServiceCandidateGenerator.PlaceDto data) {}
}
