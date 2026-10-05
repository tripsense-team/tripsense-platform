package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AdminReinstatementRequest(
    @NotNull Long expectedVersion,
    @NotBlank String reason,
    UUID remediationApplicationId
) {}
