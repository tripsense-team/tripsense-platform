package fu.tripsense.placeservice.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.ArrayList;
import java.util.List;

public record PlaceRecommendationRequest(
        @NotBlank @Size(max = 200) String query,
        @DecimalMin("-90.0") @DecimalMax("90.0") Double lat,
        @DecimalMin("-180.0") @DecimalMax("180.0") Double lng,
        @Min(100) @Max(50_000) Integer radiusMeters,
        @Min(1) @Max(50) Integer targetCount,
        @Size(max = 16) List<String> requiredFields,
        @Min(60) @Max(2_592_000) Long maximumAgeSeconds,
        Boolean allowExternalRefresh
) {
    public PlaceRecommendationRequest {
        requiredFields = requiredFields == null ? new ArrayList<>() : List.copyOf(requiredFields);
    }

    public int effectiveTargetCount() {
        return targetCount == null ? 10 : targetCount;
    }

    public long effectiveMaximumAgeSeconds() {
        return maximumAgeSeconds == null ? 2_592_000L : maximumAgeSeconds;
    }

    public boolean externalRefreshAllowed() {
        return !Boolean.FALSE.equals(allowExternalRefresh);
    }
}
