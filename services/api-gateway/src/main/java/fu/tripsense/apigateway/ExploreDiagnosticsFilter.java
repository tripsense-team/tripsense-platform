package fu.tripsense.apigateway;

import io.micrometer.core.instrument.MeterRegistry;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class ExploreDiagnosticsFilter implements GlobalFilter, Ordered {
  private static final Logger log = LoggerFactory.getLogger(ExploreDiagnosticsFilter.class);
  private static final String HEADER = "X-Request-ID";
  private final MeterRegistry registry;
  private final boolean enabled;

  public ExploreDiagnosticsFilter(
      MeterRegistry registry,
      @Value("${tripsense.explore-diagnostics.enabled:true}") boolean enabled) {
    this.registry = registry;
    this.enabled = enabled;
  }

  @Override
  public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
    if (!enabled
        || exchange.getRequest().getMethod() != HttpMethod.POST
        || !("/api/recommendations/explore-for-you".equals(exchange.getRequest().getPath().value())
            || "/api/recommendations/explore-for-you/sections"
                .equals(exchange.getRequest().getPath().value()))) {
      return chain.filter(exchange);
    }
    return Mono.defer(
        () -> {
          long started = System.nanoTime();
          // Generate at the gateway: a public caller cannot choose another request's ID.
          String requestId = UUID.randomUUID().toString();
          exchange.getResponse().getHeaders().set(HEADER, requestId);
          ServerWebExchange forwarded =
              exchange
                  .mutate()
                  .request(request -> request.headers(headers -> headers.set(HEADER, requestId)))
                  .build();
          log.info("explore_request_started service=api-gateway requestId={}", requestId);
          return Mono.defer(() -> chain.filter(forwarded))
              .doFinally(
                  signal -> {
                    long elapsed = System.nanoTime() - started;
                    String status =
                        exchange.getResponse().getStatusCode() == null
                            ? (signal == reactor.core.publisher.SignalType.ON_COMPLETE
                                ? "200"
                                : "unknown")
                            : Integer.toString(exchange.getResponse().getStatusCode().value());
                    log.info(
                        "explore_request_completed service=api-gateway requestId={} status={} durationMs={} signal={}",
                        requestId,
                        status,
                        elapsed / 1_000_000,
                        signal);
                    registry
                        .timer("tripsense.explore.request", "status", status)
                        .record(elapsed, TimeUnit.NANOSECONDS);
                  });
        });
  }

  @Override
  public int getOrder() {
    return Ordered.HIGHEST_PRECEDENCE + 10;
  }
}
