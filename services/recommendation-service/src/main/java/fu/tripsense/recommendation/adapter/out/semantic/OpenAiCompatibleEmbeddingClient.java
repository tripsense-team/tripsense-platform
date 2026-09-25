package fu.tripsense.recommendation.adapter.out.semantic;

import com.fasterxml.jackson.databind.JsonNode;
import fu.tripsense.recommendation.config.RecommendationProperties;
import java.util.List;
import java.util.Map;
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
public class OpenAiCompatibleEmbeddingClient implements EmbeddingClient {
  private final RestClient restClient;
  private final RecommendationProperties.Semantic properties;

  public OpenAiCompatibleEmbeddingClient(
      RestClient recommendationRestClient, RecommendationProperties properties) {
    this.restClient = recommendationRestClient;
    this.properties = properties.getSemantic();
  }

  @Override
  public List<Double> embed(String content) {
    if (properties.getEmbeddingBaseUrl().isBlank()) {
      throw new IllegalStateException("Embedding endpoint is not configured");
    }
    RestClient.RequestBodySpec request =
        restClient
            .post()
            .uri(properties.getEmbeddingBaseUrl() + "/embeddings")
            .header(HttpHeaders.CONTENT_TYPE, "application/json");
    if (!properties.getEmbeddingApiKey().isBlank()) {
      request.header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getEmbeddingApiKey());
    }
    JsonNode response =
        request
            .body(Map.of("model", properties.getEmbeddingModel(), "input", content))
            .retrieve()
            .body(JsonNode.class);
    JsonNode embedding = response == null ? null : response.path("data").path(0).path("embedding");
    if (embedding == null || !embedding.isArray()) {
      throw new IllegalStateException("Embedding provider returned no vector");
    }
    return StreamSupport.stream(embedding.spliterator(), false).map(JsonNode::asDouble).toList();
  }

  @Override
  public String modelVersion() {
    return properties.getEmbeddingModel();
  }
}
