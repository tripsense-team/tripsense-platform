package fu.tripsense.placeservice.providers.opentripmap;

import com.fasterxml.jackson.databind.JsonNode;
import fu.tripsense.placeservice.places.PlaceModels.MatchEvidence;
import fu.tripsense.placeservice.places.PlaceModels.PlaceEnrichment;
import fu.tripsense.placeservice.places.PlaceModels.PlaceImage;
import fu.tripsense.placeservice.places.PlaceModels.ProviderIssue;
import fu.tripsense.placeservice.providers.ProviderException;
import fu.tripsense.placeservice.providers.ProviderHttpClient;
import fu.tripsense.placeservice.providers.TimedCache;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.text.Normalizer;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class OpenTripMapPlaceEnrichmentProvider {

    private static final double MAX_MATCH_DISTANCE_METERS = 350;
    private static final double MIN_CONFIDENCE = 0.62;

    private final ProviderHttpClient httpClient;
    private final TimedCache cache;
    private final String apiKey;
    private final String baseUrl;
    private final String language;
    private final Duration timeout;

    public OpenTripMapPlaceEnrichmentProvider(
            ProviderHttpClient httpClient,
            TimedCache cache,
            @Value("${providers.opentripmap.api-key:}") String apiKey,
            @Value("${providers.opentripmap.base-url:https://api.opentripmap.com}") String baseUrl,
            @Value("${providers.opentripmap.language:en}") String language,
            @Value("${providers.opentripmap.timeout-ms:5000}") long timeoutMs
    ) {
        this.httpClient = httpClient;
        this.cache = cache;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.baseUrl = baseUrl;
        this.language = language == null || language.isBlank() ? "en" : language.trim();
        this.timeout = Duration.ofMillis(timeoutMs);
    }

    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    public PlaceEnrichment enrich(String vietMapExternalId, String name, String address, String category, double latitude, double longitude) {
        if (!isConfigured()) {
            return PlaceEnrichment.unavailable("OPENTRIPMAP_DISABLED", List.of("image", "description"), null);
        }
        String cacheKey = "opentripmap:enrich:" + vietMapExternalId;
        return (PlaceEnrichment) cache.get(cacheKey).orElseGet(() -> {
            PlaceEnrichment enrichment = fetchEnrichment(name, address, category, latitude, longitude);
            cache.put(cacheKey, enrichment, Duration.ofHours(12));
            return enrichment;
        });
    }

    private PlaceEnrichment fetchEnrichment(String name, String address, String category, double latitude, double longitude) {
        try {
            MatchCandidate match = findMatch(name, address, category, latitude, longitude);
            if (match == null) {
                return PlaceEnrichment.unavailable("NO_CONFIDENT_MATCH", List.of("image", "description"), null);
            }

            JsonNode details = getDetails(match.xid());
            String imageUrl = firstText(details, "image", details.path("preview"), "source");
            PlaceImage image = imageUrl.isBlank()
                    ? null
                    : new PlaceImage(imageUrl, "OPENTRIPMAP", "OpenTripMap", match.confidence());
            String description = firstText(details.path("wikipedia_extracts"), "text", details.path("info"), "descr");
            String detailUrl = text(details, "otm");
            String wikipediaUrl = text(details, "wikipedia");
            String wikidataId = text(details, "wikidata");
            List<String> tourismKinds = kinds(details);
            List<String> unavailable = new ArrayList<>();
            if (image == null) {
                unavailable.add("image");
            }
            if (description.isBlank()) {
                unavailable.add("description");
            }

            return new PlaceEnrichment(
                    true,
                    "MATCHED",
                    match.xid(),
                    match.confidence(),
                    match.evidence(),
                    image,
                    description.isBlank() ? null : description,
                    detailUrl.isBlank() ? null : detailUrl,
                    wikipediaUrl.isBlank() ? null : wikipediaUrl,
                    wikidataId.isBlank() ? null : wikidataId,
                    tourismKinds,
                    unavailable,
                    null
            );
        } catch (ProviderException exception) {
            ProviderIssue issue = new ProviderIssue(
                    String.valueOf(exception.details().getOrDefault("endpoint", "opentripmap")),
                    (Integer) exception.details().get("httpStatus"),
                    exception.getMessage(),
                    String.valueOf(exception.details().getOrDefault("providerMessage", ""))
            );
            return PlaceEnrichment.unavailable("PROVIDER_ERROR", List.of("image", "description"), issue);
        }
    }

    private MatchCandidate findMatch(String name, String address, String category, double latitude, double longitude) {
        URI uri = UriComponentsBuilder.fromUriString(baseUrl)
                .path("/0.1/{language}/places/radius")
                .queryParam("radius", Math.round(MAX_MATCH_DISTANCE_METERS))
                .queryParam("lon", longitude)
                .queryParam("lat", latitude)
                .queryParam("limit", 15)
                .queryParam("format", "json")
                .queryParam("apikey", apiKey)
                .encode()
                .buildAndExpand(language)
                .toUri();

        JsonNode response = httpClient.getJson(uri, timeout, Map.of(), "opentripmap", "/0.1/{lang}/places/radius");
        if (!response.isArray()) {
            return null;
        }

        List<MatchCandidate> candidates = new ArrayList<>();
        for (JsonNode result : response) {
            String xid = text(result, "xid");
            String candidateName = text(result, "name");
            if (xid.isBlank() || candidateName.isBlank()) {
                continue;
            }
            double distance = number(result, "dist", distanceMeters(latitude, longitude, pointLat(result, latitude), pointLon(result, longitude)));
            double nameSimilarity = nameSimilarity(name, candidateName);
            boolean categoryCompatible = categoryCompatible(category, text(result, "kinds"));
            boolean localityCompatible = localityCompatible(address);
            double confidence = confidence(distance, nameSimilarity, categoryCompatible, localityCompatible);
            if (distance <= MAX_MATCH_DISTANCE_METERS && confidence >= MIN_CONFIDENCE) {
                candidates.add(new MatchCandidate(
                        xid,
                        confidence,
                        new MatchEvidence(distance, nameSimilarity, categoryCompatible, localityCompatible)
                ));
            }
        }
        return candidates.stream()
                .max(Comparator.comparingDouble(MatchCandidate::confidence))
                .orElse(null);
    }

    private JsonNode getDetails(String xid) {
        URI uri = UriComponentsBuilder.fromUriString(baseUrl)
                .path("/0.1/{language}/places/xid/{xid}")
                .queryParam("apikey", apiKey)
                .encode()
                .buildAndExpand(language, xid)
                .toUri();
        return httpClient.getJson(uri, timeout, Map.of(), "opentripmap", "/0.1/{lang}/places/xid/{xid}");
    }

    public static String normalizeName(String value) {
        if (value == null) {
            return "";
        }
        String withoutMarks = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return withoutMarks.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9 ]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    public static double nameSimilarity(String left, String right) {
        String a = normalizeName(left);
        String b = normalizeName(right);
        if (a.isBlank() || b.isBlank()) {
            return 0;
        }
        if (a.equals(b)) {
            return 1;
        }
        String shorter = a.length() <= b.length() ? a : b;
        String longer = a.length() > b.length() ? a : b;
        if (longer.contains(shorter)) {
            return 0.82;
        }
        long shared = shorter.chars().filter(character -> longer.indexOf(character) >= 0).count();
        return Math.min(0.75, (double) shared / Math.max(longer.length(), 1));
    }

    private static boolean categoryCompatible(String category, String kinds) {
        if (category == null || category.isBlank() || kinds == null || kinds.isBlank()) {
            return true;
        }
        String normalizedCategory = normalizeName(category);
        String normalizedKinds = normalizeName(kinds.replace('_', ' '));
        if (normalizedKinds.contains(normalizedCategory) || normalizedCategory.contains(normalizedKinds)) {
            return true;
        }
        if (normalizedCategory.contains("coffee") || normalizedCategory.contains("cafe")) {
            return normalizedKinds.contains("cafes") || normalizedKinds.contains("foods");
        }
        if (normalizedCategory.contains("restaurant") || normalizedCategory.contains("food")) {
            return normalizedKinds.contains("foods") || normalizedKinds.contains("restaurants");
        }
        if (normalizedCategory.contains("beach") || normalizedCategory.contains("natural")) {
            return normalizedKinds.contains("natural") || normalizedKinds.contains("beaches");
        }
        return normalizedKinds.contains("interesting places") || normalizedKinds.contains("tourist");
    }

    private static boolean localityCompatible(String address) {
        return address == null || address.isBlank() || normalizeName(address).contains("da nang");
    }

    private static double confidence(double distanceMeters, double nameSimilarity, boolean categoryCompatible, boolean localityCompatible) {
        double distanceScore = Math.max(0, 1 - (distanceMeters / MAX_MATCH_DISTANCE_METERS));
        double confidence = (nameSimilarity * 0.55) + (distanceScore * 0.25);
        if (categoryCompatible) {
            confidence += 0.12;
        }
        if (localityCompatible) {
            confidence += 0.08;
        }
        return Math.min(1, confidence);
    }

    private static List<String> kinds(JsonNode details) {
        String value = text(details, "kinds");
        if (value.isBlank()) {
            return List.of();
        }
        return List.of(value.split(","));
    }

    private static String firstText(JsonNode firstNode, String firstField, JsonNode secondNode, String secondField) {
        String first = text(firstNode, firstField);
        return first.isBlank() ? text(secondNode, secondField) : first;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isTextual() ? value.asText().trim() : "";
    }

    private static double number(JsonNode node, String field, double fallback) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.asDouble() : fallback;
    }

    private static double pointLat(JsonNode node, double fallback) {
        JsonNode value = node.path("point").path("lat");
        return value.isNumber() ? value.asDouble() : fallback;
    }

    private static double pointLon(JsonNode node, double fallback) {
        JsonNode value = node.path("point").path("lon");
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

    private record MatchCandidate(String xid, double confidence, MatchEvidence evidence) {
    }
}
