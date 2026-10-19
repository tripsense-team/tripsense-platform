package fu.tripsense.recommendation.config;

import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.headerDoesNotExist;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import fu.tripsense.recommendation.application.RequestDiagnostics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;

class HttpClientConfigTest {
  @Test
  void forwardsTheActiveRequestIdAndPreservesAuthorization() {
    var builder =
        new HttpClientConfig().recommendationRestClient(new RecommendationProperties()).mutate();
    var server = MockRestServiceServer.bindTo(builder).build();
    var client = builder.build();
    server
        .expect(requestTo("http://internal/api/places/recommendations"))
        .andExpect(header("X-Request-ID", "test-request-123"))
        .andExpect(header("Authorization", "Bearer test-token"))
        .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
    RequestDiagnostics.begin("test", "test-request-123", new SimpleMeterRegistry());
    try {
      client
          .post()
          .uri("http://internal/api/places/recommendations")
          .header("Authorization", "Bearer test-token")
          .retrieve()
          .toBodilessEntity();
      server.verify();
    } finally {
      RequestDiagnostics.finish(200);
    }
  }

  @Test
  void doesNotAddCorrelationOutsideMonitoredRequests() {
    var builder =
        new HttpClientConfig().recommendationRestClient(new RecommendationProperties()).mutate();
    var server = MockRestServiceServer.bindTo(builder).build();
    var client = builder.build();
    server
        .expect(requestTo("http://internal/test"))
        .andExpect(headerDoesNotExist("X-Request-ID"))
        .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
    client.get().uri("http://internal/test").retrieve().toBodilessEntity();
    server.verify();
  }
}
