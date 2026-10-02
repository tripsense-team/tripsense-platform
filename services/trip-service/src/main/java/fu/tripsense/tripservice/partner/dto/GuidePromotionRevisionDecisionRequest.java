package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.ApplicationState;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record GuidePromotionRevisionDecisionRequest(
    @NotNull Long expectedBusinessVersion,
    @NotNull Long expectedPromotionVersion,
    @NotNull ApplicationState decision,
    @NotBlank String reason
) {}
