package fu.tripsense.recommendation.api.dto;

import fu.tripsense.recommendation.domain.GeoPoint;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import java.time.Instant;
import java.util.List;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PlaceIndexRequestItem(
    @NotBlank @Size(max = 200) String id,
    @Size(max = 80) String provider,
    @Size(max = 200) String providerPlaceId,
    @NotBlank @Size(max = 300) String name,
    @DecimalMin("-90") @DecimalMax("90") Double lat,
    @DecimalMin("-180") @DecimalMax("180") Double lng,
    @Size(max = 1000) String address,
    @Size(max = 200) String city,
    @Size(max = 200) String district,
    @Size(max = 50) List<@Size(max = 120) String> categories,
    Double rating,
    Integer userRatingCount,
    @Size(max = 20) List<@Size(max = 2000) String> photos,
    @Size(max = 2000) String openingHours,
    @Size(max = 80) String businessStatus,
    @Size(max = 5000) String description) {

  public PlaceSnapshot toDomain() {
    GeoPoint location = (lat != null && lng != null) ? new GeoPoint(lat, lng) : null;
    return new PlaceSnapshot(
        id,
        provider != null ? provider : "STORED",
        providerPlaceId != null ? providerPlaceId : id,
        name,
        location,
        address,
        city,
        district,
        categories != null ? categories : List.of(),
        rating,
        userRatingCount,
        photos != null ? photos : List.of(),
        openingHours,
        businessStatus,
        description,
        Instant.now(),
        "LIVE");
  }
}
