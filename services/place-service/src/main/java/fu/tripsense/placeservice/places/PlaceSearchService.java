package fu.tripsense.placeservice.places;

import fu.tripsense.placeservice.places.PlaceModels.PlaceEnrichment;
import fu.tripsense.placeservice.places.PlaceModels.PlaceResult;
import fu.tripsense.placeservice.places.PlaceModels.ProviderAvailability;
import fu.tripsense.placeservice.places.PlaceModels.SearchResponse;
import fu.tripsense.placeservice.providers.vietmap.VietMapPlaceProvider;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PlaceSearchService {

    public static final double DA_NANG_LATITUDE = 16.0544;
    public static final double DA_NANG_LONGITUDE = 108.2022;

    private final VietMapPlaceProvider vietMapPlaceProvider;
    private final PlaceImageResolver placeImageResolver;

    public PlaceSearchService(
            VietMapPlaceProvider vietMapPlaceProvider,
            PlaceImageResolver placeImageResolver
    ) {
        this.vietMapPlaceProvider = vietMapPlaceProvider;
        this.placeImageResolver = placeImageResolver;
    }

    public SearchResponse search(String query, Double latitude, Double longitude) {
        String normalizedQuery = requireQuery(query);
        double lat = latitude == null ? DA_NANG_LATITUDE : requireLatitude(latitude);
        double lng = longitude == null ? DA_NANG_LONGITUDE : requireLongitude(longitude);

        List<PlaceResult> places = vietMapPlaceProvider.search(normalizedQuery, lat, lng).stream()
                .map(place -> place.enrichment() == null ? withEnrichment(place, PlaceEnrichment.disabled()) : place)
                .toList();

        return new SearchResponse(
                places,
                new ProviderAvailability(vietMapPlaceProvider.isConfigured(), vietMapPlaceProvider.isConfigured() ? "CONFIGURED" : "MISSING_KEY"),
                placeImageResolver.openTripMapAvailability(),
                placeImageResolver.wikimediaAvailability()
        );
    }

    public PlaceEnrichment enrich(String externalId, String name, String address, String category, double latitude, double longitude) {
        if (externalId == null || externalId.isBlank()) {
            throw new IllegalArgumentException("externalId is required.");
        }
        requireLatitude(latitude);
        requireLongitude(longitude);
        return placeImageResolver.enrich(externalId, name, address, category, latitude, longitude);
    }

    private static PlaceResult withEnrichment(PlaceResult place, PlaceEnrichment enrichment) {
        return new PlaceResult(
                place.id(),
                place.externalId(),
                place.provider(),
                place.name(),
                place.address(),
                place.category(),
                place.latitude(),
                place.longitude(),
                place.distanceMeters(),
                enrichment
        );
    }

    private static String requireQuery(String query) {
        if (query == null || query.trim().length() < 2) {
            throw new IllegalArgumentException("Search query must be at least 2 characters.");
        }
        return query.trim();
    }

    private static double requireLatitude(double latitude) {
        if (latitude < -90 || latitude > 90) {
            throw new IllegalArgumentException("Latitude must be between -90 and 90.");
        }
        return latitude;
    }

    private static double requireLongitude(double longitude) {
        if (longitude < -180 || longitude > 180) {
            throw new IllegalArgumentException("Longitude must be between -180 and 180.");
        }
        return longitude;
    }
}
