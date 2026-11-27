package fu.tripsense.recommendation.adapter.out.semantic;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.config.RecommendationProperties;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.StreamSupport;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.web.client.HttpClientErrorException;
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
  private final ObjectMapper objectMapper;
  private final AtomicBoolean collectionReady = new AtomicBoolean();

  public QdrantVectorSearchClient(
      RestClient recommendationRestClient,
      RecommendationProperties properties,
      ObjectMapper objectMapper) {
    this.restClient = recommendationRestClient;
    this.properties = properties.getSemantic();
    this.objectMapper = objectMapper;
  }

  @PostConstruct
  void initializeCollection() {
    ensureCollection(properties.getEmbeddingDimensions());
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
    String raw =
        request
            .body(Map.of("query", vector, "limit", limit, "with_payload", true))
            .retrieve()
            .body(String.class);

    try {
      JsonNode response = raw != null ? objectMapper.readTree(raw) : null;
      JsonNode points = response == null ? null : response.path("result").path("points");
      if (points == null || !points.isArray()) return List.of();
      return StreamSupport.stream(points.spliterator(), false)
          .map(
              point ->
                  new SemanticCandidate(
                      point.path("payload").path("placeId").asText(),
                      point.path("score").asDouble()))
          .filter(value -> value.placeId() != null && !value.placeId().isBlank())
          .toList();
    } catch (Exception e) {
      return List.of();
    }
  }

  @Override
  public Optional<String> storedContentHash(String placeId) {
    return storedMetadata(placeId).map(StoredVectorMetadata::contentHash);
  }

  @Override
  public Optional<StoredVectorMetadata> storedMetadata(String placeId) {
    try {
      String raw =
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
              .body(String.class);
      if (raw == null) {
        return Optional.empty();
      }
      JsonNode response = objectMapper.readTree(raw);
      JsonNode payload = response == null ? null : response.path("result").path("payload");
      if (payload == null || payload.isMissingNode()) return Optional.empty();
      String hash = payload.path("contentHash").asText(null);
      if (hash == null) return Optional.empty();
      JsonNode revisionNode = payload.path("sourceVersion");
      Long revision = revisionNode.isIntegralNumber() ? revisionNode.longValue() : null;
      String updated = payload.path("sourceUpdatedAt").asText(null);
      Instant sourceUpdatedAt = updated == null ? null : Instant.parse(updated);
      return Optional.of(
          new StoredVectorMetadata(
              hash,
              revision,
              sourceUpdatedAt,
              payload.path("embeddingVersion").asText(null)));
    } catch (Exception exception) {
      return Optional.empty();
    }
  }

  @Override
  public void upsert(String placeId, List<Double> vector, String modelVersion, String contentHash) {
    upsert(placeId, vector, modelVersion, contentHash, null, null);
  }

  @Override
  public void upsert(
      String placeId,
      List<Double> vector,
      String modelVersion,
      String contentHash,
      Long sourceVersion,
      Instant sourceUpdatedAt) {
    ensureCollection(vector.size());
    Map<String, Object> payload = new java.util.LinkedHashMap<>();
    payload.put("placeId", placeId);
    payload.put("embeddingModel", modelVersion);
    payload.put("embeddingVersion", modelVersion);
    payload.put("contentHash", contentHash);
    if (sourceVersion != null) payload.put("sourceVersion", sourceVersion);
    if (sourceUpdatedAt != null) payload.put("sourceUpdatedAt", sourceUpdatedAt.toString());
    Map<String, Object> point =
        Map.of(
            "id",
            pointId(placeId),
            "vector",
            vector,
            "payload",
            payload);
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

  @Override
  public void delete(String placeId) {
    RestClient.RequestBodySpec request = restClient.post().uri(
        properties.getQdrantUrl() + "/collections/" + properties.getCollection() + "/points/delete?wait=true");
    configure(request);
    request.body(Map.of("points", List.of(pointId(placeId)))).retrieve().toBodilessEntity();
  }

  private void ensureCollection(int vectorSize) {
    if (collectionReady.get()) return;
    synchronized (collectionReady) {
      if (collectionReady.get()) return;
      try {
        String raw =
            request(
                    restClient
                        .get()
                        .uri(
                            properties.getQdrantUrl()
                                + "/collections/"
                                + properties.getCollection()))
                .retrieve()
                .body(String.class);
        validateVectorSize(raw, vectorSize);
      } catch (HttpClientErrorException.NotFound missingCollection) {
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
      collectionReady.set(true);
    }
  }

  private void validateVectorSize(String raw, int expected) {
    try {
      JsonNode response = raw == null ? null : objectMapper.readTree(raw);
      JsonNode vectors =
          response == null
              ? null
              : response.path("result").path("config").path("params").path("vectors");
      JsonNode vectorConfig = resolveUnnamedVectorConfig(vectors);
      JsonNode size = vectorConfig == null ? null : vectorConfig.path("size");
      if (size == null || !size.isIntegralNumber()) {
        throw new IllegalStateException("Qdrant collection vector size is unavailable");
      }
      if (size.intValue() != expected) {
        throw new IllegalStateException("Qdrant collection vector size does not match configuration");
      }
      if (!"cosine".equalsIgnoreCase(vectorConfig.path("distance").asText())) {
        throw new IllegalStateException("Qdrant collection distance does not match configuration");
      }
    } catch (IllegalStateException invalid) {
      throw invalid;
    } catch (Exception invalidResponse) {
      throw new IllegalStateException("Qdrant collection metadata is invalid", invalidResponse);
    }
  }

  private JsonNode resolveUnnamedVectorConfig(JsonNode vectors) {
    if (vectors == null || vectors.isMissingNode()) return vectors;
    if (vectors.path("size").isIntegralNumber()) return vectors;

    JsonNode unnamedVector = vectors.path("");
    return unnamedVector.isObject() ? unnamedVector : vectors;
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
