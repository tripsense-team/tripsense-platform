package fu.tripsense.recommendation.adapter.out.http;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.DiscoveryCategory;
import fu.tripsense.recommendation.domain.GeoPoint;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
        .andExpect(jsonPath("$.query").value("quiet cafe"))
        .andExpect(jsonPath("$.allowExternalRefresh").value(true))
        .andExpect(jsonPath("$.mediaReadyOnly").value(false))
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

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void sendsExplicitRefreshPolicyWithoutChangingTarget(boolean allowed) {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    RecommendationProperties properties = new RecommendationProperties();
    properties.getDownstream().setPlaceUrl("http://place-service:8082");
    var original = context();
    var selected = original.withExternalRefresh(allowed);
    assertThat(original.allowExternalRefresh()).isTrue();
    assertThat(selected.withExternalRefresh(true)).isEqualTo(original);
    server
        .expect(requestTo("http://place-service:8082/api/places/recommendations"))
        .andExpect(method(POST))
        .andExpect(jsonPath("$.allowExternalRefresh").value(allowed))
        .andExpect(jsonPath("$.targetCount").value(15))
        .andExpect(jsonPath("$.requiredFields[0]").value("id"))
        .andRespond(
            withSuccess(
                "{\"success\":true,\"data\":{\"candidates\":[]}}", MediaType.APPLICATION_JSON));
    assertThat(
            new PlaceServiceCandidateGenerator(builder.build(), properties)
                .generate(selected)
                .candidates())
        .isEmpty();
    server.verify();
  }

  @Test
  void legacyShortContextAlsoDefaultsToExternalRefreshAllowed() {
    var source = context();
    var legacy =
        new RecommendationContext(
            source.requestId(),
            source.userId(),
            null,
            source.sessionId(),
            source.query(),
            source.anchor(),
            source.radiusMeters(),
            source.preferredCategories(),
            source.dislikedCategories(),
            source.profile(),
            null,
            source.limit());
    assertThat(legacy.allowExternalRefresh()).isTrue();
  }

  @Test
  void defersMediaGateWhenReadyInventoryIsBelowThreshold() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    RecommendationProperties properties = new RecommendationProperties();
    properties.getDownstream().setPlaceUrl("http://place-service:8082");
    properties.getRetrieval().setMediaReadyOnly(true);
    properties.getRetrieval().setMediaMinimumReadyCandidates(2);
    server.expect(requestTo("http://place-service:8082/api/places/recommendations"))
        .andExpect(jsonPath("$.mediaReadyOnly").value(false))
        .andRespond(withSuccess("""
            {"success":true,"data":{"candidates":[
              {"id":"place-1","name":"Place One","media":{"state":"READY"}},
              {"id":"place-2","name":"Place Two","media":{"state":"PENDING"}}
            ]}}
            """, MediaType.APPLICATION_JSON));

    var result = new PlaceServiceCandidateGenerator(builder.build(), properties).generate(context());

    assertThat(result.candidates()).hasSize(2);
    assertThat(result.degradations()).contains("MEDIA_GATE_BELOW_SAFE_THRESHOLD");
    server.verify();
  }

  @Test
  void enforcesMediaGateOnlyAfterCoverageAndCandidateCountPass() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    RecommendationProperties properties = new RecommendationProperties();
    properties.getDownstream().setPlaceUrl("http://place-service:8082");
    properties.getRetrieval().setMediaReadyOnly(true);
    properties.getRetrieval().setMediaMinimumReadyCandidates(2);
    String response = """
        {"success":true,"data":{"candidates":[
          {"id":"place-1","name":"Place One","media":{"state":"READY"}},
          {"id":"place-2","name":"Place Two","media":{"state":"READY"}}
        ]}}
        """;
    server.expect(requestTo("http://place-service:8082/api/places/recommendations"))
        .andExpect(jsonPath("$.mediaReadyOnly").value(false))
        .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
    server.expect(requestTo("http://place-service:8082/api/places/recommendations"))
        .andExpect(jsonPath("$.mediaReadyOnly").value(true))
        .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));

    var result = new PlaceServiceCandidateGenerator(builder.build(), properties).generate(context());

    assertThat(result.candidates()).hasSize(2);
    assertThat(result.degradations()).doesNotContain("MEDIA_GATE_BELOW_SAFE_THRESHOLD");
    server.verify();
  }

  @Test
  void keepsCategoryBaselineWhenMediaCoverageIsInsufficient() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    RecommendationProperties properties = new RecommendationProperties();
    properties.getDownstream().setPlaceUrl("http://place-service:8082");
    properties.getRetrieval().setMediaReadyOnly(true);
    properties.getRetrieval().setMediaMinimumReadyCandidates(2);
    server.expect(requestTo("http://place-service:8082/api/places/recommendations/categories"))
        .andExpect(jsonPath("$.mediaReadyOnly").value(false))
        .andRespond(withSuccess("""
            {"success":true,"data":{"groups":[{"category":"CAFE","status":"READY",
              "places":[{"id":"place-1","name":"Cafe One","media":{"state":"PENDING"}}],
              "degradations":[]}]}}
            """, MediaType.APPLICATION_JSON));

    var result = new PlaceServiceCandidateGenerator(builder.build(), properties)
        .generateCategories(context(), java.util.List.of(DiscoveryCategory.CAFE), 5);

    assertThat(result.groups()).hasSize(1);
    assertThat(result.groups().getFirst().candidates()).hasSize(1);
    assertThat(result.groups().getFirst().degradations())
        .contains("MEDIA_GATE_BELOW_SAFE_THRESHOLD");
    server.verify();
  }

  @Test
  void enforcesReadyCategoryOnlyWhenBothResponsesMeetThreshold() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    RecommendationProperties properties = new RecommendationProperties();
    properties.getDownstream().setPlaceUrl("http://place-service:8082");
    properties.getRetrieval().setMediaReadyOnly(true);
    properties.getRetrieval().setMediaMinimumReadyCandidates(2);
    String response = """
        {"success":true,"data":{"groups":[{"category":"CAFE","status":"READY",
          "places":[
            {"id":"place-1","name":"Cafe One","media":{"state":"READY"}},
            {"id":"place-2","name":"Cafe Two","media":{"state":"READY"}}
          ],"degradations":[]}]}}
        """;
    server.expect(requestTo("http://place-service:8082/api/places/recommendations/categories"))
        .andExpect(jsonPath("$.mediaReadyOnly").value(false))
        .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
    server.expect(requestTo("http://place-service:8082/api/places/recommendations/categories"))
        .andExpect(jsonPath("$.mediaReadyOnly").value(true))
        .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));

    var result = new PlaceServiceCandidateGenerator(builder.build(), properties)
        .generateCategories(context(), java.util.List.of(DiscoveryCategory.CAFE), 5);

    assertThat(result.groups()).hasSize(1);
    assertThat(result.groups().getFirst().candidates()).hasSize(2);
    assertThat(result.groups().getFirst().degradations())
        .doesNotContain("MEDIA_GATE_BELOW_SAFE_THRESHOLD");
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
