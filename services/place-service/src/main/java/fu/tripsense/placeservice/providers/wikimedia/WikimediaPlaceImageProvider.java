package fu.tripsense.placeservice.providers.wikimedia;

import com.fasterxml.jackson.databind.JsonNode;
import fu.tripsense.placeservice.places.PlaceModels.PlaceImage;
import fu.tripsense.placeservice.providers.ProviderException;
import fu.tripsense.placeservice.providers.ProviderHttpClient;
import fu.tripsense.placeservice.providers.TimedCache;
import fu.tripsense.placeservice.providers.opentripmap.OpenTripMapPlaceEnrichmentProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Component
public class WikimediaPlaceImageProvider {

    private static final double MAX_DISTANCE_METERS = 600;
    private static final double MIN_CONFIDENCE = 0.64;

    private final ProviderHttpClient httpClient;
    private final TimedCache cache;
    private final String baseUrl;
    private final Duration timeout;

    public WikimediaPlaceImageProvider(
            ProviderHttpClient httpClient,
            TimedCache cache,
            @Value("${providers.wikimedia.base-url:https://en.wikipedia.org}") String baseUrl,
            @Value("${providers.wikimedia.timeout-ms:5000}") long timeoutMs
    ) {
        this.httpClient = httpClient;
        this.cache = cache;
        this.baseUrl = baseUrl;
        this.timeout = Duration.ofMillis(timeoutMs);
    }

    public boolean isConfigured() {
        return true;
    }

    public WikimediaResult resolve(String vietMapExternalId, String name, String category, double latitude, double longitude) {
        String cacheKey = "wikimedia:image:" + vietMapExternalId;
        return (WikimediaResult) cache.get(cacheKey).orElseGet(() -> {
            WikimediaResult result = fetch(name, category, latitude, longitude);
            cache.put(cacheKey, result, Duration.ofHours(12));
            return result;
        });
    }

    private WikimediaResult fetch(String name, String category, double latitude, double longitude) {
        URI uri = UriComponentsBuilder.fromUriString(baseUrl)
                .path("/w/api.php")
                .queryParam("action", "query")
                .queryParam("format", "json")
                .queryParam("generator", "geosearch")
                .queryParam("ggscoord", latitude + "|" + longitude)
                .queryParam("ggsradius", Math.round(MAX_DISTANCE_METERS))
                .queryParam("ggslimit", 10)
                .queryParam("prop", "coordinates|pageimages|extracts|info")
                .queryParam("pithumbsize", 640)
                .queryParam("exintro", true)
                .queryParam("explaintext", true)
                .queryParam("inprop", "url")
                .encode()
                .build()
                .toUri();

        JsonNode response = httpClient.getJson(
                uri,
                timeout,
                Map.of("User-Agent", "TripSensePlaceProviderPOC/0.1"),
                "wikimedia",
                "/w/api.php"
        );
        JsonNode pages = response.path("query").path("pages");
        if (!pages.isObject()) {
            return WikimediaResult.empty();
        }

        List<Candidate> candidates = new ArrayList<>();
        for (Map.Entry<String, JsonNode> entry : pages.properties()) {
            JsonNode page = entry.getValue();
            String imageUrl = text(page.path("thumbnail"), "source");
            if (imageUrl.isBlank()) {
                continue;
            }
            String title = text(page, "title");
            double pageLat = coordinate(page, "lat", latitude);
            double pageLon = coordinate(page, "lon", longitude);
            double distance = distanceMeters(latitude, longitude, pageLat, pageLon);
            double nameSimilarity = OpenTripMapPlaceEnrichmentProvider.nameSimilarity(name, title);
            boolean categoryCompatible = categoryCompatible(category, title);
            double confidence = confidence(distance, nameSimilarity, categoryCompatible);
            if (confidence >= MIN_CONFIDENCE && distance <= MAX_DISTANCE_METERS) {
                candidates.add(new Candidate(page, imageUrl, title, confidence));
            }
        }

        return candidates.stream()
                .max(Comparator.comparingDouble(Candidate::confidence))
                .map(candidate -> new WikimediaResult(
                        new PlaceImage(candidate.imageUrl(), "WIKIMEDIA", candidate.title(), candidate.confidence()),
                        text(candidate.page(), "extract"),
                        text(candidate.page(), "fullurl")
                ))
                .orElseGet(WikimediaResult::empty);
    }

    private static boolean categoryCompatible(String category, String title) {
        if (category == null || category.isBlank()) {
            return true;
        }
        String normalizedCategory = OpenTripMapPlaceEnrichmentProvider.normalizeName(category);
        String normalizedTitle = OpenTripMapPlaceEnrichmentProvider.normalizeName(title);
        if (normalizedTitle.contains(normalizedCategory) || normalizedCategory.contains(normalizedTitle)) {
            return true;
        }
        if (normalizedCategory.contains("beach") || normalizedCategory.contains("natural")) {
            return normalizedTitle.contains("beach") || normalizedTitle.contains("mountain") || normalizedTitle.contains("river");
        }
        if (normalizedCategory.contains("tour") || normalizedCategory.contains("attraction")) {
            return true;
        }
        return normalizedCategory.contains("place");
    }

    private static double confidence(double distanceMeters, double nameSimilarity, boolean categoryCompatible) {
        double distanceScore = Math.max(0, 1 - (distanceMeters / MAX_DISTANCE_METERS));
        double confidence = (nameSimilarity * 0.62) + (distanceScore * 0.26);
        if (categoryCompatible) {
            confidence += 0.12;
        }
        return Math.min(1, confidence);
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isTextual() ? value.asText().trim() : "";
    }

    private static double coordinate(JsonNode page, String field, double fallback) {
        JsonNode coordinates = page.path("coordinates");
        if (!coordinates.isArray() || coordinates.isEmpty()) {
            return fallback;
        }
        JsonNode value = coordinates.get(0).path(field);
        return value.isNumber() ? value.asDouble() : fallback;
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

    public record WikimediaResult(PlaceImage image, String description, String pageUrl) {
        static WikimediaResult empty() {
            return new WikimediaResult(null, null, null);
        }
    }

    private record Candidate(JsonNode page, String imageUrl, String title, double confidence) {
    }
}
