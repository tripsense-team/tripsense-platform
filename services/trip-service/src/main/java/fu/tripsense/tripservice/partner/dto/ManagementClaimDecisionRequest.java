package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record ManagementClaimDecisionRequest(
    @NotNull Long expectedVersion,
    @NotBlank String outcome,
    List<UUID> linkedBusinessIds,
    @NotBlank String reason
) {}
