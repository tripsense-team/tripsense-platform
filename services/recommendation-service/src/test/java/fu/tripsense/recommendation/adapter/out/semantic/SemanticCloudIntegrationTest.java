package fu.tripsense.recommendation.adapter.out.semantic;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import fu.tripsense.recommendation.config.RecommendationProperties;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

class SemanticCloudIntegrationTest {

  private String embeddingApiKey;
  private String qdrantApiKey;
  private String qdrantUrl;

  @BeforeEach
  void setUp() {
    embeddingApiKey = System.getenv("SEMANTIC_EMBEDDING_API_KEY");
    qdrantApiKey = System.getenv("SEMANTIC_QDRANT_API_KEY");
    qdrantUrl = System.getenv("SEMANTIC_QDRANT_URL");
    assumeTrue(
        embeddingApiKey != null
            && !embeddingApiKey.isBlank()
            && qdrantApiKey != null
            && !qdrantApiKey.isBlank()
            && qdrantUrl != null
            && !qdrantUrl.isBlank(),
        "Cloud integration tests require SEMANTIC_EMBEDDING_API_KEY, SEMANTIC_QDRANT_API_KEY, SEMANTIC_QDRANT_URL");
  }

  @Test
  @DisplayName("Embed content via Gemini OpenAI-compatible API and upsert into Qdrant Cloud")
  void testGeminiEmbeddingAndQdrantUpsert() {
    RecommendationProperties properties = new RecommendationProperties();
    properties.getSemantic().setEnabled(true);
    properties
        .getSemantic()
        .setEmbeddingBaseUrl(
            System.getenv()
                .getOrDefault(
                    "SEMANTIC_EMBEDDING_BASE_URL",
                    "https://generativelanguage.googleapis.com/v1beta/openai"));
    properties.getSemantic().setEmbeddingApiKey(embeddingApiKey);
    properties.getSemantic().setEmbeddingModel("gemini-embedding-001");
    properties.getSemantic().setQdrantUrl(qdrantUrl);
    properties.getSemantic().setQdrantApiKey(qdrantApiKey);
    properties.getSemantic().setCollection("tripsense_places");

    HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
    requestFactory.setReadTimeout(Duration.ofSeconds(15));
    RestClient restClient = RestClient.builder().requestFactory(requestFactory).build();

    com.fasterxml.jackson.databind.ObjectMapper objectMapper =
        new com.fasterxml.jackson.databind.ObjectMapper();
    OpenAiCompatibleEmbeddingClient embeddingClient =
        new OpenAiCompatibleEmbeddingClient(restClient, properties, objectMapper);
    QdrantVectorSearchClient qdrantClient =
        new QdrantVectorSearchClient(restClient, properties, objectMapper);

    // 1. Test embedding
    List<Double> vector = embeddingClient.embed("Quán Cà Phê Trứng Hà Nội - Đặc sản phố cổ");
    assertThat(vector).isNotEmpty();
    assertThat(vector.size()).isEqualTo(1536);

    // 2. Test upsert
    String testPlaceId = "place-live-test-001";
    String contentHash = "hash-123456";
    qdrantClient.upsert(testPlaceId, vector, "gemini-embedding-001", contentHash);

    // 3. Test stored content hash check
    var retrievedHash = qdrantClient.storedContentHash(testPlaceId);
    assertThat(retrievedHash).isPresent();
    assertThat(retrievedHash.get()).isEqualTo(contentHash);

    // 4. Test vector search
    var searchResults = qdrantClient.search(vector, 3);
    assertThat(searchResults).isNotEmpty();
    assertThat(searchResults.stream().anyMatch(c -> c.placeId().equals(testPlaceId))).isTrue();
  }
}
