package fu.tripsense.placeservice.places;

import java.util.List;

public final class PlaceModels {

    private PlaceModels() {
    }

    public record SearchResponse(
            List<PlaceResult> places,
            ProviderAvailability vietMap,
            ProviderAvailability openTripMap,
            ProviderAvailability wikimedia
    ) {
    }

    public record PlaceResult(
            String id,
            String externalId,
            String provider,
            String name,
            String address,
            String category,
            double latitude,
            double longitude,
            double distanceMeters,
            PlaceEnrichment enrichment
    ) {
    }

    public record PlaceEnrichment(
            boolean enabled,
            String status,
            String externalPlaceId,
            Double confidence,
            MatchEvidence evidence,
            PlaceImage image,
            String description,
            String detailUrl,
            String wikipediaUrl,
            String wikidataId,
            List<String> tourismKinds,
            List<String> unavailableFields,
            ProviderIssue providerIssue
    ) {
        public static PlaceEnrichment disabled() {
            return new PlaceEnrichment(false, "DISABLED", null, null, null, null, null, null, null, null, List.of(), List.of(), null);
        }

        public static PlaceEnrichment unavailable(String status, List<String> unavailableFields, ProviderIssue issue) {
            return new PlaceEnrichment(true, status, null, null, null, null, null, null, null, null, List.of(), unavailableFields, issue);
        }
    }

    public record ProviderAvailability(boolean configured, String status) {
    }

    public record ProviderIssue(String endpoint, Integer httpStatus, String message, String providerMessage) {
    }

    public record PlaceImage(String url, String source, String attribution, Double confidence) {
    }

    public record MatchEvidence(
            double distanceMeters,
            double nameSimilarity,
            boolean categoryCompatible,
            boolean localityCompatible
    ) {
    }
}
