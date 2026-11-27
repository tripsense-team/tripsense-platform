package fu.tripsense.recommendation.adapter.out.semantic;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.config.RecommendationProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class QdrantVectorSearchClientTest {
  private static final String COLLECTION_URL =
      "https://qdrant.example/collections/tripsense_places";

  @Test
  void acceptsDirectUnnamedVectorMetadata() {
    String response =
        """
        {"result":{"config":{"params":{"vectors":{"size":1536,"distance":"Cosine"}}}}}
        """;

    assertDoesNotThrow(() -> initializeWith(response));
  }

  @Test
  void acceptsQdrantCloudEmptyNameRepresentationForUnnamedVector() {
    String response =
        """
        {"result":{"config":{"params":{"vectors":{"":{"size":1536,"distance":"Cosine"}}}}}}
        """;

    assertDoesNotThrow(() -> initializeWith(response));
  }

  @Test
  void rejectsNamedVectorMetadataBecauseRequestsUseTheUnnamedVectorContract() {
    String response =
        """
        {"result":{"config":{"params":{"vectors":{"places":{"size":1536,"distance":"Cosine"}}}}}}
        """;

    assertThrows(IllegalStateException.class, () -> initializeWith(response));
  }

  @Test
  void rejectsMismatchedUnnamedVectorDimensions() {
    String response =
        """
        {"result":{"config":{"params":{"vectors":{"":{"size":768,"distance":"Cosine"}}}}}}
        """;

    assertThrows(IllegalStateException.class, () -> initializeWith(response));
  }

  private void initializeWith(String response) {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    server
        .expect(requestTo(COLLECTION_URL))
        .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));

    RecommendationProperties properties = new RecommendationProperties();
    properties.getSemantic().setQdrantUrl("https://qdrant.example");
    properties.getSemantic().setCollection("tripsense_places");
    properties.getSemantic().setEmbeddingDimensions(1536);

    QdrantVectorSearchClient client =
        new QdrantVectorSearchClient(builder.build(), properties, new ObjectMapper());
    client.initializeCollection();
    server.verify();
  }
}
