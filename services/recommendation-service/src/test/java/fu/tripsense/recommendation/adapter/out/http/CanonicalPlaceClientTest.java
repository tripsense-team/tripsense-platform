package fu.tripsense.recommendation.adapter.out.http;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import fu.tripsense.recommendation.application.RequestDiagnostics;
import fu.tripsense.recommendation.config.RecommendationProperties;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class CanonicalPlaceClientTest {
  private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
  private final RestClient.Builder builder = RestClient.builder();
  private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
  private final RecommendationProperties properties = new RecommendationProperties();

  @BeforeEach
  void start() {
    properties.getDownstream().setPlaceUrl("http://internal");
    RequestDiagnostics.begin("test", "snapshot-test-123", registry);
  }

  @AfterEach
  void stop() {
    RequestDiagnostics.finish(200);
    registry.close();
  }

  @Test
  void batchSuccessRetainsAliasesAndAvoidsIndividualLookups() {
    server
        .expect(requestTo("http://internal/api/places/batch-snapshots"))
        .andRespond(
            withSuccess(
                "{\"success\":true,\"data\":[{\"id\":\"p1\",\"providerPlaceId\":\"alias1\",\"primaryType\":\"coffee_shop\"}]}",
                MediaType.APPLICATION_JSON));
    var resolved = client().resolveBatch(List.of("alias1"));
    assertThat(resolved).containsKeys("p1", "alias1");
    assertThat(resolved.get("p1").primaryType()).isEqualTo("coffee_shop");
    assertPhase("snapshot_batch_http", "success", 1);
    assertThat(registry.find("tripsense.explore.phase").tag("phase", "snapshot_individual").timer())
        .isNull();
    server.verify();
  }

  @Test
  void batchFailureRecordsErrorAndMeasuresEveryFallbackCall() {
    server
        .expect(requestTo("http://internal/api/places/batch-snapshots"))
        .andRespond(withServerError());
    for (String id : List.of("p1", "p2")) {
      server
          .expect(requestTo("http://internal/api/places/" + id))
          .andRespond(
              withSuccess(
                  "{\"success\":true,\"data\":{\"id\":\"" + id + "\"}}",
                  MediaType.APPLICATION_JSON));
    }
    assertThat(client().resolveBatch(List.of("p1", "p2"))).hasSize(2);
    assertPhase("snapshot_batch_http", "error", 1);
    assertPhase("snapshot_batch_fallback", "success", 1);
    assertPhase("snapshot_individual", "success", 2);
    server.verify();
  }

  @Test
  void individualFailureStillReturnsEmptyAndRecordsError() {
    server.expect(requestTo("http://internal/api/places/p1")).andRespond(withServerError());
    assertThat(client().find("p1")).isEmpty();
    assertPhase("snapshot_individual", "error", 1);
    server.verify();
  }

  @Test
  void emptyBatchMakesNoHttpCalls() {
    assertThat(client().resolveBatch(List.of())).isEmpty();
    assertThat(registry.getMeters()).isEmpty();
    server.verify();
  }

  @Test
  void localOnlyBatchFailureNeverFallsBackToProviderCapableDetailEndpoint() {
    server
        .expect(requestTo("http://internal/api/places/batch-snapshots"))
        .andRespond(withServerError());
    assertThat(client().resolveLocalBatch(List.of("p1", "p2"))).isEmpty();
    assertThat(registry.find("tripsense.explore.phase").tag("phase", "snapshot_individual").timer())
        .isNull();
    server.verify();
  }

  @Test
  void localOnlySuccessRetainsCanonicalAndProviderAliases() {
    server
        .expect(requestTo("http://internal/api/places/batch-snapshots"))
        .andRespond(
            withSuccess(
                "{\"success\":true,\"data\":[{\"id\":\"p1\",\"providerPlaceId\":\"alias1\"}]}",
                MediaType.APPLICATION_JSON));
    assertThat(client().resolveLocalBatch(List.of("alias1"))).containsKeys("p1", "alias1");
    server.verify();
  }

  private CanonicalPlaceClient client() {
    return new CanonicalPlaceClient(builder.build(), properties);
  }

  private void assertPhase(String name, String outcome, int count) {
    assertThat(
            registry
                .get("tripsense.explore.phase")
                .tags("phase", name, "outcome", outcome)
                .timer()
                .count())
        .isEqualTo(count);
  }
}
