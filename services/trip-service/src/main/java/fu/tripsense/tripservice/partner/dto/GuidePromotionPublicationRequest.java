package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.PublicationState;
import jakarta.validation.constraints.NotNull;

public record GuidePromotionPublicationRequest(
    @NotNull Long expectedVersion,
    @NotNull PublicationState state
) {}
