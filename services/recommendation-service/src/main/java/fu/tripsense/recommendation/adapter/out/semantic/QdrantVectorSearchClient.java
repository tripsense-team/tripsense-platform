package fu.tripsense.recommendation.adapter.out.semantic;

import com.fasterxml.jackson.databind.JsonNode;
import fu.tripsense.recommendation.config.RecommendationProperties;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@ConditionalOnProperty(
    prefix = "tripsense.recommendation.semantic",
    name = "enabled",
    havingValue = "true")
public class QdrantVectorSearchClient implements VectorSearchClient {
  private final RestClient restClient;
  private final RecommendationProperties.Semantic properties;

  public QdrantVectorSearchClient(
      RestClient recommendationRestClient, RecommendationProperties properties) {
    this.restClient = recommendationRestClient;
    this.properties = properties.getSemantic();
  }

  @Override
  public List<SemanticCandidate> search(List<Double> vector, int limit) {
    RestClient.RequestBodySpec request =
        restClient
            .post()
            .uri(
                properties.getQdrantUrl()
                    + "/collections/"
                    + properties.getCollection()
                    + "/points/query");
    configure(request);
    JsonNode response =
        request
            .body(Map.of("query", vector, "limit", limit, "with_payload", true))
            .retrieve()
            .body(JsonNode.class);
    JsonNode points = response == null ? null : response.path("result").path("points");
    if (points == null || !points.isArray()) return List.of();
    return StreamSupport.stream(points.spliterator(), false)
        .map(
            point ->
                new SemanticCandidate(
                    point.path("payload").path("placeId").asText(), point.path("score").asDouble()))
        .filter(value -> value.placeId() != null && !value.placeId().isBlank())
        .toList();
  }

  @Override
  public Optional<String> storedContentHash(String placeId) {
    try {
      JsonNode response =
          request(
                  restClient
                      .get()
                      .uri(
                          properties.getQdrantUrl()
                              + "/collections/"
                              + properties.getCollection()
                              + "/points/"
                              + pointId(placeId)))
              .retrieve()
              .body(JsonNode.class);
      String value =
          response == null
              ? null
              : response.path("result").path("payload").path("contentHash").asText(null);
      return Optional.ofNullable(value);
    } catch (RuntimeException exception) {
      return Optional.empty();
    }
  }

  @Override
  public void upsert(String placeId, List<Double> vector, String modelVersion, String contentHash) {
    ensureCollection(vector.size());
    Map<String, Object> point =
        Map.of(
            "id",
            pointId(placeId),
            "vector",
            vector,
            "payload",
            Map.of(
                "placeId", placeId,
                "embeddingModel", modelVersion,
                "embeddingVersion", modelVersion,
                "contentHash", contentHash));
    RestClient.RequestBodySpec request =
        restClient
            .put()
            .uri(
                properties.getQdrantUrl()
                    + "/collections/"
                    + properties.getCollection()
                    + "/points?wait=true");
    configure(request);
    request.body(Map.of("points", List.of(point))).retrieve().toBodilessEntity();
  }

  private void ensureCollection(int vectorSize) {
    try {
      request(
              restClient
                  .get()
                  .uri(properties.getQdrantUrl() + "/collections/" + properties.getCollection()))
          .retrieve()
          .toBodilessEntity();
    } catch (RuntimeException missingCollection) {
      RestClient.RequestBodySpec create =
          restClient
              .put()
              .uri(properties.getQdrantUrl() + "/collections/" + properties.getCollection());
      configure(create);
      create
          .body(Map.of("vectors", Map.of("size", vectorSize, "distance", "Cosine")))
          .retrieve()
          .toBodilessEntity();
    }
  }

  private RestClient.RequestHeadersSpec<?> request(RestClient.RequestHeadersSpec<?> request) {
    configure(request);
    return request;
  }

  private void configure(RestClient.RequestHeadersSpec<?> request) {
    if (!properties.getQdrantApiKey().isBlank()) {
      request.header("api-key", properties.getQdrantApiKey());
    }
    request.header(HttpHeaders.CONTENT_TYPE, "application/json");
  }

  private UUID pointId(String placeId) {
    return UUID.nameUUIDFromBytes(placeId.getBytes(StandardCharsets.UTF_8));
  }
}
