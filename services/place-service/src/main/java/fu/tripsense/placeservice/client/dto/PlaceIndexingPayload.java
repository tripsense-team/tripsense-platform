package fu.tripsense.placeservice.client.dto;

import fu.tripsense.placeservice.dto.PlaceDto;
import java.time.Instant;
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
    String description,
    String primaryType,
    Long sourceVersion,
    Instant sourceUpdatedAt) {

  public static PlaceIndexingPayload from(PlaceDto dto) {
    return from(dto, null, null);
  }

  public static PlaceIndexingPayload from(
      PlaceDto dto, Long sourceVersion, Instant sourceUpdatedAt) {
    if (dto == null) return null;
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
        dto.getDescription(),
        dto.getPrimaryType(),
        sourceVersion,
        sourceUpdatedAt);
  }
}
