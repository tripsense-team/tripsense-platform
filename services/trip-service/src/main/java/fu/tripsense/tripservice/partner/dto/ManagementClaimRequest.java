package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ManagementClaimRequest(
    @NotNull UUID businessId,
    @NotBlank String reason
) {}
