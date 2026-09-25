package fu.tripsense.recommendation.adapter.out.http;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.GeoPoint;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class PlaceServiceCandidateGeneratorTest {
  @Test
  void preservesExistingPlaceContractAndRetrievalEvidence() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    RecommendationProperties properties = new RecommendationProperties();
    properties.getDownstream().setPlaceUrl("http://place-service:8082");
    PlaceServiceCandidateGenerator generator =
        new PlaceServiceCandidateGenerator(builder.build(), properties);
    server
        .expect(requestTo("http://place-service:8082/api/places/recommendations"))
        .andExpect(method(POST))
        .andExpect(jsonPath("$.query").value("cafe"))
        .andRespond(
            withSuccess(
                """
                {
                  "success": true,
                  "unknownEnvelopeField": "forward-compatible",
                  "data": {
                    "candidates": [{
                      "id": "place-1",
                      "provider": "ZIOMAP",
                      "providerPlaceId": "provider-1",
                      "name": "Cafe One",
                      "location": {"lat": 16.05, "lng": 108.20},
                      "categories": ["CAFE"],
                      "rating": 4.6,
                      "userRatingCount": 120,
                      "businessStatus": "OPERATIONAL",
                      "futureField": true
                    }],
                    "evidence": {
                      "status": "PARTIAL",
                      "queryResolved": true,
                      "candidateCount": 1,
                      "eligibleCount": 1,
                      "requiredFieldCoverage": {"location": 1.0},
                      "geographicCoverage": 1.0,
                      "freshness": "FRESH",
                      "sourceSet": ["MONGO"],
                      "retrievedAt": "2026-09-24T10:00:00Z",
                      "providerStatus": "NOT_REQUIRED",
                      "refreshPerformed": false,
                      "reasonCodes": ["LOW_CANDIDATE_COUNT"],
                      "rankingVersion": "place-rank-v1"
                    }
                  }
                }
                """,
                MediaType.APPLICATION_JSON));

    var result = generator.generate(context());

    assertThat(result.candidates()).hasSize(1);
    assertThat(result.candidates().getFirst().place().id()).isEqualTo("place-1");
    assertThat(result.candidates().getFirst().retrievalEvidence().rankingVersion())
        .isEqualTo("place-rank-v1");
    assertThat(result.candidates().getFirst().retrievalEvidence().reasonCodes())
        .containsExactly("LOW_CANDIDATE_COUNT");
    assertThat(result.degradations()).containsExactly("PLACE_RETRIEVAL_PARTIAL");
    server.verify();
  }

  private RecommendationContext context() {
    return new RecommendationContext(
        UUID.randomUUID(),
        UUID.randomUUID(),
        null,
        "session",
        "quiet cafe",
        new GeoPoint(16.05, 108.20),
        5_000,
        Set.of(),
        Set.of(),
        Set.of("cafe"),
        null,
        java.util.List.of(),
        null,
        null,
        5);
  }
}
