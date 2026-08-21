package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.dto.PlaceDto;

import java.util.List;

public interface PlaceRankingService {

    List<PlaceDto> rank(List<PlaceDto> places, String query, Double targetLat, Double targetLng);

}
