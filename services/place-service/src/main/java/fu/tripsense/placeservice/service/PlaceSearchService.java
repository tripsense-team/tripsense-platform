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

  /**
   * Retrieves and ranks canonical place candidates for downstream recommendation processing. This
   * contract does not perform user- or trip-personalized final ranking.
   */
  PlaceRecommendationResult recommend(PlaceRecommendationRequest request);
}
