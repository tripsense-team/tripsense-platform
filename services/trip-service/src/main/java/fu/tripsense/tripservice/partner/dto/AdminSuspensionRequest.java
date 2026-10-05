package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AdminSuspensionRequest(
    @NotNull Long expectedVersion,
    @NotBlank String reason
) {}
