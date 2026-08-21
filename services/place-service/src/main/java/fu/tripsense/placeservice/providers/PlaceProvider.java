package fu.tripsense.placeservice.providers;

import fu.tripsense.placeservice.dto.AutocompleteSuggestionDto;
import fu.tripsense.placeservice.dto.PlaceDto;

import java.util.List;
import java.util.Optional;

public interface PlaceProvider {

    String getProviderName();

    List<PlaceDto> textSearch(String query, Double lat, Double lng, Integer radiusMeters, Integer limit);

    List<AutocompleteSuggestionDto> autocomplete(String query, Double lat, Double lng, Integer radiusMeters, Integer limit);

    Optional<PlaceDto> getPlaceDetails(String providerPlaceId);
}
