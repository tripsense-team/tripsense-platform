package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.dto.PlaceDto;
import java.util.List;

public interface PlaceRankingService {

  /**
   * Ranks places for retrieval quality; final personalized ranking belongs to
   * recommendation-service.
   */
  List<PlaceDto> rank(List<PlaceDto> places, String query, Double targetLat, Double targetLng);
}
