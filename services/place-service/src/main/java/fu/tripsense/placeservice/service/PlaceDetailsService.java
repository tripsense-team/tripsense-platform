package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.dto.PlaceDto;
import java.util.List;
import java.util.Optional;

public interface PlaceDetailsService {

  Optional<PlaceDto> getDetails(
      String id, String fallbackName, Double fallbackLat, Double fallbackLng);

  Optional<PlaceDto> getDetails(
      String id, String fallbackName, Double fallbackLat, Double fallbackLng, boolean includePhoto);

  List<PlaceDto> getSnapshots(List<String> ids);
}
