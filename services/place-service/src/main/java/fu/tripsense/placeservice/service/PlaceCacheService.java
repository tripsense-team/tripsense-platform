package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.dto.AutocompleteSuggestionDto;
import fu.tripsense.placeservice.dto.PlaceDto;

import java.util.List;
import java.util.Optional;

public interface PlaceCacheService {

    Optional<List<PlaceDto>> getSearchResults(
            String normalizedQuery, double lat, double lng, int radius, int limit);

    void putSearchResults(
            String normalizedQuery, double lat, double lng, int radius, int limit, List<PlaceDto> results);

    Optional<List<AutocompleteSuggestionDto>> getAutocomplete(
            String normalizedQuery, double lat, double lng, int radius, int limit);

    void putAutocomplete(
            String normalizedQuery, double lat, double lng, int radius, int limit,
            List<AutocompleteSuggestionDto> suggestions);

    Optional<PlaceDto> getPlaceDetails(String placeId);

    void putPlaceDetails(String placeId, PlaceDto place);
}
