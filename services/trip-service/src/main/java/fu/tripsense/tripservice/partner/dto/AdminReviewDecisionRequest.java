package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.PartnerCapability;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record AdminReviewDecisionRequest(
    @NotNull Long expectedBusinessVersion,
    @NotNull Long expectedApplicationVersion,
    @NotBlank String decision,
    List<ChecklistResultDto> checklistResults,
    List<CapabilityDecisionDto> capabilityDecisions,
    String reason
) {
  public record ChecklistResultDto(String code, String result, String reason) {}
  public record CapabilityDecisionDto(PartnerCapability capability, boolean grant, String reason) {}
}
