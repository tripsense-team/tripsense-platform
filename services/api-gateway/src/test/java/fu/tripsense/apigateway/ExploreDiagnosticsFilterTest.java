package fu.tripsense.apigateway;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

class ExploreDiagnosticsFilterTest {
  @Test
  void createsIdAndPropagatesItOnResponseAndDownstreamRequest() {
    var registry = new SimpleMeterRegistry();
    var exchange =
        MockServerWebExchange.from(
            MockServerHttpRequest.post("/api/recommendations/explore-for-you")
                .header("X-Request-ID", "untrusted-id"));
    new ExploreDiagnosticsFilter(registry, true)
        .filter(
            exchange,
            forwarded -> {
              String id = forwarded.getRequest().getHeaders().getFirst("X-Request-ID");
              assertThat(id).matches("[a-f0-9-]{36}").isNotEqualTo("untrusted-id");
              assertThat(exchange.getResponse().getHeaders().getFirst("X-Request-ID"))
                  .isEqualTo(id);
              return forwarded.getResponse().setComplete();
            })
        .block();
    assertThat(registry.get("tripsense.explore.request").timer().count()).isEqualTo(1);
  }

  @Test
  void recordsErrorAndPreservesFailure() {
    var registry = new SimpleMeterRegistry();
    var exchange =
        MockServerWebExchange.from(
            MockServerHttpRequest.post("/api/recommendations/explore-for-you"));
    var failure = new IllegalStateException("failure");
    assertThatThrownBy(
            () ->
                new ExploreDiagnosticsFilter(registry, true)
                    .filter(exchange, ignored -> Mono.error(failure))
                    .block())
        .isSameAs(failure);
    assertThat(registry.get("tripsense.explore.request").timer().count()).isEqualTo(1);
  }

  @Test
  void disabledFilterDoesNotAlterRequests() {
    var registry = new SimpleMeterRegistry();
    var exchange =
        MockServerWebExchange.from(
            MockServerHttpRequest.post("/api/recommendations/explore-for-you"));
    new ExploreDiagnosticsFilter(registry, false).filter(exchange, ignored -> Mono.empty()).block();
    assertThat(exchange.getResponse().getHeaders().getFirst("X-Request-ID")).isNull();
    assertThat(registry.getMeters()).isEmpty();
  }
}
