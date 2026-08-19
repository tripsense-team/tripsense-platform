package fu.tripsense.placeservice.routes;

import com.fasterxml.jackson.databind.JsonNode;
import fu.tripsense.placeservice.providers.ProviderException;
import fu.tripsense.placeservice.providers.ProviderHttpClient;
import fu.tripsense.placeservice.providers.TimedCache;
import fu.tripsense.placeservice.routes.RouteModels.LatLng;
import fu.tripsense.placeservice.routes.RouteModels.RouteRequest;
import fu.tripsense.placeservice.routes.RouteModels.RouteResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class RouteService {

    private final ProviderHttpClient httpClient;
    private final TimedCache cache;
    private final String apiKey;
    private final String baseUrl;
    private final Duration timeout;

    public RouteService(
            ProviderHttpClient httpClient,
            TimedCache cache,
            @Value("${providers.vietmap.api-key:}") String apiKey,
            @Value("${providers.vietmap.base-url:https://maps.vietmap.vn}") String baseUrl,
            @Value("${providers.vietmap.timeout-ms:5000}") long timeoutMs
    ) {
        this.httpClient = httpClient;
        this.cache = cache;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.baseUrl = baseUrl;
        this.timeout = Duration.ofMillis(timeoutMs);
    }

    public RouteResponse route(RouteRequest request) {
        validate(request);
        String mode = request.mode() == null || request.mode().isBlank() ? "car" : request.mode();
        String cacheKey = "vietmap:route:" + request.origin() + ":" + request.destination() + ":" + mode;
        return (RouteResponse) cache.get(cacheKey).orElseGet(() -> {
            RouteResponse response = fetchRoute(request.origin(), request.destination(), mode);
            cache.put(cacheKey, response, Duration.ofMinutes(10));
            return response;
        });
    }

    private RouteResponse fetchRoute(LatLng origin, LatLng destination, String mode) {
        if (apiKey.isBlank()) {
            throw new ProviderException(ProviderException.Kind.MISSING_CONFIGURATION, "VIETMAP_DISABLED", "VietMap service key is not configured.");
        }
        URI uri = UriComponentsBuilder.fromUriString(baseUrl)
                .path("/api/route/v4")
                .queryParam("apikey", apiKey)
                .queryParam("point", origin.latitude() + "," + origin.longitude())
                .queryParam("point", destination.latitude() + "," + destination.longitude())
                .queryParam("points_encoded", false)
                .queryParam("vehicle", mode)
                .encode()
                .build()
                .toUri();

        JsonNode response = httpClient.getJson(uri, timeout, Map.of(), "vietmap", "/api/route/v4");
        JsonNode paths = response.path("paths");
        if (!paths.isArray() || paths.isEmpty()) {
            throw new ProviderException(ProviderException.Kind.NOT_FOUND, "ROUTE_NOT_FOUND", "VietMap did not return a route.");
        }
        JsonNode path = paths.get(0);
        return new RouteResponse(
                path.path("distance").asDouble(),
                Math.round(path.path("time").asDouble() / 1000.0),
                geometry(path.path("points"))
        );
    }

    private static List<LatLng> geometry(JsonNode points) {
        if (points.path("coordinates").isArray()) {
            return geometryFromCoordinatePairs(points.path("coordinates"), true);
        }
        if (points.isArray()) {
            return geometryFromCoordinatePairs(points, false);
        }
        return List.of();
    }

    private static List<LatLng> geometryFromCoordinatePairs(JsonNode coordinates, boolean longitudeFirst) {
        if (!coordinates.isArray()) {
            return List.of();
        }
        List<LatLng> geometry = new ArrayList<>();
        for (JsonNode point : coordinates) {
            if (point.isArray() && point.size() >= 2) {
                double first = point.get(0).asDouble();
                double second = point.get(1).asDouble();
                geometry.add(longitudeFirst ? new LatLng(second, first) : new LatLng(first, second));
            }
        }
        return geometry;
    }

    private static void validate(RouteRequest request) {
        if (request == null || request.origin() == null || request.destination() == null) {
            throw new IllegalArgumentException("origin and destination are required.");
        }
        validateCoordinate(request.origin());
        validateCoordinate(request.destination());
        String mode = request.mode() == null || request.mode().isBlank() ? "car" : request.mode();
        if (!mode.equals("car") && !mode.equals("motorcycle")) {
            throw new IllegalArgumentException("mode must be car or motorcycle.");
        }
    }

    private static void validateCoordinate(LatLng coordinate) {
        if (coordinate.latitude() < -90 || coordinate.latitude() > 90) {
            throw new IllegalArgumentException("Latitude must be between -90 and 90.");
        }
        if (coordinate.longitude() < -180 || coordinate.longitude() > 180) {
            throw new IllegalArgumentException("Longitude must be between -180 and 180.");
        }
    }
}
