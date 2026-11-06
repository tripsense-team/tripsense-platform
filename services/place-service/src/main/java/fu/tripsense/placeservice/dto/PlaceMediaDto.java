package fu.tripsense.placeservice.dto;

import java.util.List;

public record PlaceMediaDto(
    String state,
    PlaceMediaAssetDto primary,
    List<PlaceMediaAssetDto> gallery,
    String fallbackKind) {
  public PlaceMediaDto {
    gallery = gallery == null ? List.of() : List.copyOf(gallery);
  }
}
