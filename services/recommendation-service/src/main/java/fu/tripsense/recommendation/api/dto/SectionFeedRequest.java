package fu.tripsense.recommendation.api.dto;

import fu.tripsense.recommendation.domain.DiscoveryCategory;
import jakarta.validation.constraints.*;
import java.util.UUID;

public record SectionFeedRequest(
    @NotBlank @Pattern(regexp = "[a-z0-9-]{1,64}") String destinationId,
    @Pattern(regexp = "[A-Za-z0-9._:-]{1,128}") String sessionId,
    DiscoveryCategory section,
    @Min(1) @Max(48) Integer limit,
    UUID seedId) {
  @AssertTrue(message = "Preview size must be four")
  public boolean isValidPreviewLimit() {
    return section != null || limit == null || limit == 4;
  }

  public int effectiveLimit() {
    return section == null ? 4 : limit == null ? 48 : limit;
  }
}
