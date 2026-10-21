package fu.tripsense.apigateway;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Bounded, response-sanitizing adapter for the private Loki query API. */
final class AdminLogsGatewayFilter implements WebFilter {
  private static final Logger log = LoggerFactory.getLogger(AdminLogsGatewayFilter.class);
  private static final Set<String> SERVICES = Set.of(
      "api-gateway", "discovery-server", "user-service", "place-service",
      "trip-service", "social-service", "context-service", "recommendation-service",
      "mail-service", "ai-service");
  private static final Set<String> LEVELS = Set.of("INFO", "WARN", "ERROR");
  private final WebClient client;
  private final ObjectMapper mapper;
  private final boolean enabled;
  private final String baseUrl;

  AdminLogsGatewayFilter(
      WebClient.Builder builder,
      ObjectMapper mapper,
      @Value("${tripsense.observability.logs.enabled:false}") boolean enabled,
      @Value("${tripsense.observability.loki.base-url:http://loki:3100}") String baseUrl) {
    this.client = builder.baseUrl(baseUrl).build();
    this.mapper = mapper;
    this.enabled = enabled;
    this.baseUrl = baseUrl;
  }

  @Override
  public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
    var request = exchange.getRequest();
    if (!"/api/ops/logs".equals(request.getPath().value())) return chain.filter(exchange);
    if (!enabled) return writeError(exchange, HttpStatus.SERVICE_UNAVAILABLE, "OBSERVABILITY_UNAVAILABLE");

    var query = request.getQueryParams();
    var service = query.getFirst("service");
    var level = query.getFirst("level");
    var range = query.getFirst("range");
    int limit;
    try {
      limit = Integer.parseInt(query.getFirst("limit") == null ? "100" : query.getFirst("limit"));
    } catch (NumberFormatException ex) {
      return writeError(exchange, HttpStatus.BAD_REQUEST, "INVALID_LOG_FILTER");
    }
    if (service == null || !SERVICES.contains(service) || (level != null && !LEVELS.contains(level))
        || !Set.of("15m", "1h", "6h", "24h").contains(range == null ? "1h" : range)
        || limit < 1 || limit > 200) {
      return writeError(exchange, HttpStatus.BAD_REQUEST, "INVALID_LOG_FILTER");
    }

    var effectiveRange = range == null ? "1h" : range;
    var seconds = switch (effectiveRange) { case "15m" -> 900; case "6h" -> 21600; case "24h" -> 86400; default -> 3600; };
    var end = Instant.now();
    var logql = "{service=\"" + service + "\"}";
    // Spring's default text logger carries severity in the line itself. Use a
    // bounded line filter so INFO/WARN/ERROR works for both plain and JSON logs.
    if (level != null) logql += " |= \" " + level + " \"";
    var correlation = query.getFirst("correlationRef");
    if (correlation != null && !correlation.matches("[A-Za-z0-9._:-]{1,128}"))
      return writeError(exchange, HttpStatus.BAD_REQUEST, "INVALID_LOG_FILTER");
    if (correlation != null) logql += " |= \"" + correlation + "\"";
    final String queryLogql = logql;

    var lokiUri = UriComponentsBuilder.fromUriString(baseUrl).path("/loki/api/v1/query_range")
        .queryParam("query", queryLogql)
        .queryParam("limit", limit)
        .queryParam("start", end.minusSeconds(seconds).toEpochMilli() * 1_000_000)
        .queryParam("end", end.toEpochMilli() * 1_000_000)
        .build()
        .encode()
        .toUri();
    return client.get().uri(lokiUri)
        .retrieve().bodyToMono(String.class).timeout(Duration.ofSeconds(3))
        .flatMap(body -> writeJson(exchange, sanitize(body, limit)))
        .onErrorResume(error -> {
          log.warn("Loki query unavailable: {}", error.toString());
          return writeError(exchange, HttpStatus.SERVICE_UNAVAILABLE, "OBSERVABILITY_UNAVAILABLE");
        });
  }

  private String sanitize(String body, int limit) {
    try {
      var root = mapper.readTree(body);
      var entries = mapper.createArrayNode();
      for (var stream : root.path("data").path("result")) {
        var labels = stream.path("stream");
        for (var value : stream.path("values")) {
          if (entries.size() >= limit) break;
          var line = value.get(1).asText("").trim();
          if (line.isBlank() || containsSensitiveContent(line)) continue;
          JsonNode parsed;
          try {
            parsed = mapper.readTree(line);
          } catch (Exception ignored) {
            parsed = mapper.createObjectNode();
          }
          var entry = mapper.createObjectNode();
          entry.put("timestamp", Instant.ofEpochMilli(value.get(0).asLong() / 1_000_000).toString());
          entry.put("service", labels.path("service").asText("unknown"));
          var detectedLevel = labels.path("level").asText(parsed.path("level").asText(detectLevel(line)));
          entry.put("level", LEVELS.contains(detectedLevel) ? detectedLevel : "INFO");
          entry.put("eventCode", parsed.path("eventCode").asText("SERVICE_LOG"));
          entry.put("safeMessage", parsed.path("safeMessage").asText(sanitizePlainText(line)));
          if (parsed.has("correlationRef")) entry.put("correlationRef", parsed.path("correlationRef").asText());
          entries.add(entry);
        }
      }
      var result = mapper.createObjectNode();
      result.put("success", true);
      var data = result.putObject("data");
      data.set("entries", entries);
      data.putNull("nextCursor");
      data.put("truncated", entries.size() >= limit);
      return mapper.writeValueAsString(result);
    } catch (Exception ignored) {
      return "{\"success\":true,\"data\":{\"entries\":[],\"nextCursor\":null,\"truncated\":false}}";
    }
  }

  private static String detectLevel(String line) {
    var upper = line.toUpperCase(Locale.ROOT);
    if (upper.contains(" ERROR ") || upper.startsWith("ERROR")) return "ERROR";
    if (upper.contains(" WARN ") || upper.startsWith("WARN")) return "WARN";
    return "INFO";
  }

  private static boolean containsSensitiveContent(String line) {
    var lower = line.toLowerCase(Locale.ROOT);
    return lower.contains("password") || lower.contains("secret") || lower.contains("authorization")
        || lower.contains("bearer ") || lower.contains("jdbc:") || lower.contains("sql")
        || lower.contains("stacktrace") || lower.contains("exception:");
  }

  private static String sanitizePlainText(String line) {
    var safe = line.replaceAll("(?i)[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", "[redacted-email]");
    safe = safe.replaceAll("(?i)Bearer\\s+[A-Za-z0-9._~+/=-]+", "Bearer [redacted]");
    safe = safe.replaceAll("https?://\\S+", "[redacted-url]");
    return safe.length() > 240 ? safe.substring(0, 240) : safe;
  }

  private Mono<Void> writeError(ServerWebExchange exchange, HttpStatus status, String code) {
    exchange.getResponse().setStatusCode(status);
    return writeJson(exchange, "{\"success\":false,\"code\":\"" + code + "\"}");
  }

  private Mono<Void> writeJson(ServerWebExchange exchange, String body) {
    exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
    DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
    return exchange.getResponse().writeWith(Mono.just(buffer));
  }
}
