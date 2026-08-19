package fu.tripsense.placeservice.places;

import fu.tripsense.placeservice.places.PlaceModels.PlaceEnrichment;
import fu.tripsense.placeservice.places.PlaceModels.PlaceImage;
import fu.tripsense.placeservice.places.PlaceModels.ProviderAvailability;
import fu.tripsense.placeservice.places.PlaceModels.ProviderIssue;
import fu.tripsense.placeservice.providers.ProviderException;
import fu.tripsense.placeservice.providers.opentripmap.OpenTripMapPlaceEnrichmentProvider;
import fu.tripsense.placeservice.providers.wikimedia.WikimediaPlaceImageProvider;
import fu.tripsense.placeservice.providers.wikimedia.WikimediaPlaceImageProvider.WikimediaResult;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class PlaceImageResolver {

    private final OpenTripMapPlaceEnrichmentProvider openTripMapProvider;
    private final WikimediaPlaceImageProvider wikimediaProvider;

    public PlaceImageResolver(
            OpenTripMapPlaceEnrichmentProvider openTripMapProvider,
            WikimediaPlaceImageProvider wikimediaProvider
    ) {
        this.openTripMapProvider = openTripMapProvider;
        this.wikimediaProvider = wikimediaProvider;
    }

    public ProviderAvailability openTripMapAvailability() {
        return new ProviderAvailability(
                openTripMapProvider.isConfigured(),
                openTripMapProvider.isConfigured() ? "CONFIGURED" : "MISSING_KEY"
        );
    }

    public ProviderAvailability wikimediaAvailability() {
        return new ProviderAvailability(wikimediaProvider.isConfigured(), "CONFIGURED");
    }

    public PlaceEnrichment enrich(String externalId, String name, String address, String category, double latitude, double longitude) {
        PlaceEnrichment openTripMap = openTripMapProvider.enrich(externalId, name, address, category, latitude, longitude);
        if (hasImage(openTripMap)) {
            return openTripMap;
        }

        try {
            WikimediaResult wikimedia = wikimediaProvider.resolve(externalId, name, category, latitude, longitude);
            if (wikimedia.image() == null) {
                return withTripSenseFallback(openTripMap);
            }
            return mergeWikimedia(openTripMap, wikimedia);
        } catch (ProviderException exception) {
            return withTripSenseFallback(openTripMap);
        }
    }

    private static PlaceEnrichment mergeWikimedia(PlaceEnrichment base, WikimediaResult wikimedia) {
        List<String> unavailable = new ArrayList<>(base.unavailableFields());
        unavailable.remove("image");
        if (wikimedia.description() != null && !wikimedia.description().isBlank()) {
            unavailable.remove("description");
        }
        String description = base.description() == null || base.description().isBlank()
                ? emptyToNull(wikimedia.description())
                : base.description();
        String wikipediaUrl = base.wikipediaUrl() == null || base.wikipediaUrl().isBlank()
                ? emptyToNull(wikimedia.pageUrl())
                : base.wikipediaUrl();
        String status = "MATCHED".equals(base.status()) ? "MATCHED_WITH_WIKIMEDIA_IMAGE" : "WIKIMEDIA_FALLBACK";

        return copy(
                base,
                status,
                base.externalPlaceId(),
                base.confidence() == null ? wikimedia.image().confidence() : base.confidence(),
                wikimedia.image(),
                description,
                wikipediaUrl,
                unavailable,
                base.providerIssue()
        );
    }

    private static PlaceEnrichment withTripSenseFallback(PlaceEnrichment base) {
        List<String> unavailable = new ArrayList<>(base.unavailableFields());
        if (base.image() == null) {
            unavailable.remove("image");
        }
        PlaceImage fallback = base.image() == null
                ? new PlaceImage(null, "TRIPSENSE", "TripSense fallback", null)
                : base.image();
        String status = "MATCHED".equals(base.status()) ? "MATCHED_WITH_TRIPSENSE_FALLBACK" : base.status();
        return copy(
                base,
                status,
                base.externalPlaceId(),
                base.confidence(),
                fallback,
                base.description(),
                base.wikipediaUrl(),
                unavailable,
                base.providerIssue()
        );
    }

    private static PlaceEnrichment copy(
            PlaceEnrichment base,
            String status,
            String externalPlaceId,
            Double confidence,
            PlaceImage image,
            String description,
            String wikipediaUrl,
            List<String> unavailableFields,
            ProviderIssue providerIssue
    ) {
        return new PlaceEnrichment(
                true,
                status,
                externalPlaceId,
                confidence,
                base.evidence(),
                image,
                description,
                base.detailUrl(),
                wikipediaUrl,
                base.wikidataId(),
                base.tourismKinds(),
                unavailableFields,
                providerIssue
        );
    }

    private static boolean hasImage(PlaceEnrichment enrichment) {
        return enrichment.image() != null && enrichment.image().url() != null && !enrichment.image().url().isBlank();
    }

    private static String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
