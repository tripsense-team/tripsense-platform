package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotNull;

public record SubmitGuidePromotionRequest(
    @NotNull Long expectedVersion
) {}
