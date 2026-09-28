package fu.tripsense.placeservice.client.dto;

import fu.tripsense.placeservice.dto.PlaceDto;
import java.util.List;

public record PlaceIndexingPayload(
    String id,
    String provider,
    String providerPlaceId,
    String name,
    Double lat,
    Double lng,
    String address,
    String city,
    String district,
    List<String> categories,
    Double rating,
    Integer userRatingCount,
    List<String> photos,
    String openingHours,
    String businessStatus,
    String description) {

  public static PlaceIndexingPayload from(PlaceDto dto) {
    if (dto == null) {
      return null;
    }
    Double lat = dto.getLocation() != null ? dto.getLocation().getLat() : null;
    Double lng = dto.getLocation() != null ? dto.getLocation().getLng() : null;
    return new PlaceIndexingPayload(
        dto.getId(),
        dto.getProvider(),
        dto.getProviderPlaceId(),
        dto.getName(),
        lat,
        lng,
        dto.getAddress(),
        dto.getCity(),
        dto.getDistrict(),
        dto.getCategories(),
        dto.getRating(),
        dto.getUserRatingCount(),
        dto.getPhotos(),
        dto.getOpeningHours(),
        dto.getBusinessStatus(),
        dto.getDescription());
  }
}
