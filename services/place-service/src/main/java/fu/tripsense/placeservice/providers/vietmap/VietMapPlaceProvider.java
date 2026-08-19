package fu.tripsense.placeservice.providers.vietmap;

import com.fasterxml.jackson.databind.JsonNode;
import fu.tripsense.placeservice.places.PlaceModels.PlaceResult;
import fu.tripsense.placeservice.providers.ProviderException;
import fu.tripsense.placeservice.providers.ProviderHttpClient;
import fu.tripsense.placeservice.providers.TimedCache;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class VietMapPlaceProvider {

    private static final int RESULT_LIMIT = 10;
    private static final double DETAIL_RADIUS_METERS = 6000;

    private final ProviderHttpClient httpClient;
    private final TimedCache cache;
    private final String apiKey;
    private final String baseUrl;
    private final Duration timeout;

    public VietMapPlaceProvider(
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

    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    @SuppressWarnings("unchecked")
    public List<PlaceResult> search(String query, double latitude, double longitude) {
        requireConfigured();
        String cacheKey = "vietmap:search:" + normalize(query) + ":" + latitude + ":" + longitude;
        return (List<PlaceResult>) cache.get(cacheKey).orElseGet(() -> {
            List<PlaceResult> places = fetchSearch(query, latitude, longitude);
            cache.put(cacheKey, places, Duration.ofMinutes(10));
            return places;
        });
    }

    private List<PlaceResult> fetchSearch(String query, double latitude, double longitude) {
        URI uri = UriComponentsBuilder.fromUriString(baseUrl)
                .path("/api/autocomplete/v4")
                .queryParam("apikey", apiKey)
                .queryParam("text", query)
                .queryParam("focus", latitude + "," + longitude)
                .queryParam("circle_center", latitude + "," + longitude)
                .queryParam("circle_radius", Math.round(DETAIL_RADIUS_METERS))
                .queryParam("layers", "POI")
                .queryParam("display_type", 1)
                .encode()
                .build()
                .toUri();

        JsonNode response = httpClient.getJson(uri, timeout, Map.of(), "vietmap", "/api/autocomplete/v4");
        if (!response.isArray()) {
            throw new ProviderException(ProviderException.Kind.UNAVAILABLE, "VIETMAP_UNEXPECTED_RESPONSE", "VietMap search response shape was unexpected.");
        }

        List<PlaceResult> results = new ArrayList<>();
        for (JsonNode item : response) {
            String externalId = text(item, "ref_id");
            if (externalId.isBlank()) {
                continue;
            }
            PlaceResult detailed = detailFromRef(externalId, item, latitude, longitude);
            if (detailed != null) {
                results.add(detailed);
            }
            if (results.size() >= RESULT_LIMIT) {
                break;
            }
        }
        return results;
    }

    private PlaceResult detailFromRef(String externalId, JsonNode searchItem, double latitude, double longitude) {
        URI uri = UriComponentsBuilder.fromUriString(baseUrl)
                .path("/api/place/v4")
                .queryParam("apikey", apiKey)
                .queryParam("refid", externalId)
                .encode()
                .build()
                .toUri();

        JsonNode detail = httpClient.getJson(uri, timeout, Map.of(), "vietmap", "/api/place/v4");
        double lat = number(detail, "lat", Double.NaN);
        double lng = number(detail, "lng", Double.NaN);
        if (Double.isNaN(lat) || Double.isNaN(lng)) {
            return null;
        }
        String name = firstText(detail, searchItem, "name");
        if (name.isBlank()) {
            name = firstText(detail, searchItem, "display");
        }
        String address = firstText(detail, searchItem, "display");
        if (address.isBlank()) {
            address = firstText(detail, searchItem, "address");
        }
        return new PlaceResult(
                "ts-poc-" + shortHash(externalId),
                externalId,
                "VIETMAP",
                name,
                address,
                category(searchItem),
                lat,
                lng,
                distanceMeters(latitude, longitude, lat, lng),
                null
        );
    }

    private void requireConfigured() {
        if (!isConfigured()) {
            throw new ProviderException(ProviderException.Kind.MISSING_CONFIGURATION, "VIETMAP_DISABLED", "VietMap service key is not configured.");
        }
    }

    private static String category(JsonNode node) {
        JsonNode categories = node.path("categories");
        if (!categories.isArray() || categories.isEmpty()) {
            return "Place";
        }
        JsonNode first = categories.get(0);
        if (first.isTextual()) {
            return first.asText();
        }
        String name = text(first, "name");
        return name.isBlank() ? "Place" : name;
    }

    private static String firstText(JsonNode preferred, JsonNode fallback, String field) {
        String value = text(preferred, field);
        return value.isBlank() ? text(fallback, field) : value;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isTextual() ? value.asText().trim() : "";
    }

    private static double number(JsonNode node, String field, double fallback) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.asDouble() : fallback;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static String shortHash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, 16);
        } catch (NoSuchAlgorithmException exception) {
            return Integer.toHexString(value.hashCode());
        }
    }

    private static double distanceMeters(double fromLat, double fromLng, double toLat, double toLng) {
        double earthRadiusMeters = 6_371_000;
        double phi1 = Math.toRadians(fromLat);
        double phi2 = Math.toRadians(toLat);
        double deltaPhi = Math.toRadians(toLat - fromLat);
        double deltaLambda = Math.toRadians(toLng - fromLng);
        double a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2)
                + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
