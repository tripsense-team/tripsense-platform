package fu.tripsense.recommendation.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ExploreRecommendationRequest(
    @NotBlank @Pattern(regexp = "[a-z0-9-]{1,64}") String destinationId,
    @Size(max = 200) @Pattern(regexp = "^[^\\p{Cc}\\p{Cf}]*$") String query,
    @Pattern(regexp = "[A-Za-z0-9._:-]{1,128}") String sessionId,
    @Min(1) @Max(48) Integer limit) {

  public int effectiveLimit() {
    return limit == null ? 20 : limit;
  }

  public String normalizedQuery() {
    return query == null ? "" : query.trim();
  }
}
