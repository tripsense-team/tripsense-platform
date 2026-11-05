package fu.tripsense.placeservice.dto;

import java.util.List;

public record PlaceMediaAssetDto(
    String assetId,
    String url,
    Integer width,
    Integer height,
    String alt,
    List<AttributionDto> attribution) {
  public PlaceMediaAssetDto {
    attribution = attribution == null ? List.of() : List.copyOf(attribution);
  }

  public record AttributionDto(String label, String url) {}
}
