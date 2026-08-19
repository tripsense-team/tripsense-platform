package fu.tripsense.placeservice.providers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@Component
public class ProviderHttpClient {

    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    private final ObjectMapper objectMapper;

    public ProviderHttpClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public JsonNode getJson(URI uri, Duration timeout, Map<String, String> headers, String provider, String endpoint) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                .timeout(timeout)
                .GET()
                .header("Accept", "application/json");
        headers.forEach(builder::header);

        try {
            HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return objectMapper.readTree(response.body());
            }
            throw providerError(response.statusCode(), response.body(), provider, endpoint);
        } catch (IOException exception) {
            throw new ProviderException(
                    ProviderException.Kind.UNAVAILABLE,
                    provider.toUpperCase() + "_UNAVAILABLE",
                    provider + " provider is unavailable.",
                    Map.of("endpoint", endpoint)
            );
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ProviderException(
                    ProviderException.Kind.UNAVAILABLE,
                    provider.toUpperCase() + "_INTERRUPTED",
                    provider + " provider request was interrupted.",
                    Map.of("endpoint", endpoint)
            );
        }
    }

    private ProviderException providerError(int status, String body, String provider, String endpoint) {
        ProviderException.Kind kind = switch (status) {
            case 400 -> ProviderException.Kind.BAD_REQUEST;
            case 401 -> ProviderException.Kind.UNAUTHORIZED;
            case 403 -> ProviderException.Kind.FORBIDDEN;
            case 404 -> ProviderException.Kind.NOT_FOUND;
            case 429 -> ProviderException.Kind.RATE_LIMITED;
            default -> ProviderException.Kind.UNAVAILABLE;
        };
        return new ProviderException(
                kind,
                provider.toUpperCase() + "_HTTP_" + status,
                provider + " provider returned HTTP " + status + ".",
                Map.of(
                        "endpoint", endpoint,
                        "httpStatus", status,
                        "providerMessage", sanitizeBody(body)
                )
        );
    }

    static String sanitizeBody(String body) {
        if (body == null || body.isBlank()) {
            return "";
        }
        String compact = body.replaceAll("\\s+", " ").trim()
                .replaceAll("(?i)(apikey|api_key|key)=([^&\\s\"']+)", "$1=[REDACTED]")
                .replaceAll("(?i)(authorization\\s*[:=]\\s*bearer\\s+)([^\\s\"']+)", "$1[REDACTED]");
        return compact.length() <= 240 ? compact : compact.substring(0, 240);
    }
}
