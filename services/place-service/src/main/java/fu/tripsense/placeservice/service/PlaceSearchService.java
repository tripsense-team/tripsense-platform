package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.dto.AutocompleteSuggestionDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.dto.PlaceRecommendationRequest;
import fu.tripsense.placeservice.dto.PlaceRecommendationResult;
import java.util.List;

public interface PlaceSearchService {

  List<PlaceDto> searchPlaces(String query, Double lat, Double lng, Integer radius, Integer limit);

  List<AutocompleteSuggestionDto> autocomplete(
      String query, Double lat, Double lng, Integer radius, Integer limit);

  List<PlaceDto> getNearbyPlaces(
      Double lat, Double lng, Integer radius, String category, Integer limit);

  PlaceRecommendationResult recommend(PlaceRecommendationRequest request);
}

