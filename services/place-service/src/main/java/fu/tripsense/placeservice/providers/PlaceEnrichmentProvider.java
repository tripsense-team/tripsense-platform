package fu.tripsense.placeservice.providers;

import fu.tripsense.placeservice.dto.PlaceDto;

import java.util.Optional;

public interface PlaceEnrichmentProvider {

    Optional<PlaceDto> enrichPlace(String placeName, Double lat, Double lng);
}
