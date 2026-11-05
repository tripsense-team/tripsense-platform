package fu.tripsense.placeservice.dto;

import jakarta.validation.constraints.*;
import java.util.List;

public record PlaceCategoryBatchRequest(
    @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
    @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng,
    @NotNull @Min(100) @Max(50000) Integer radiusMeters,
    @NotEmpty @Size(max = 4) List<@NotNull DiscoveryCategory> categories,
    @NotNull @Min(1) @Max(50) Integer targetPerCategory,
    @Min(60) @Max(2592000) Long maximumAgeSeconds,
    @Size(max = 16) List<String> requiredFields,
    @NotNull @AssertFalse Boolean allowExternalRefresh,
    Boolean mediaReadyOnly) {
  @AssertTrue(message = "Categories must be unique")
  public boolean isUniqueCategories() {
    return categories == null || categories.stream().distinct().count() == categories.size();
  }

  public boolean mediaReadyOnlyEnabled() {
    return Boolean.TRUE.equals(mediaReadyOnly);
  }

  public PlaceCategoryBatchRequest(
      Double lat,
      Double lng,
      Integer radiusMeters,
      List<DiscoveryCategory> categories,
      Integer targetPerCategory,
      Long maximumAgeSeconds,
      List<String> requiredFields,
      Boolean allowExternalRefresh) {
    this(lat, lng, radiusMeters, categories, targetPerCategory, maximumAgeSeconds, requiredFields,
        allowExternalRefresh, false);
  }
}
