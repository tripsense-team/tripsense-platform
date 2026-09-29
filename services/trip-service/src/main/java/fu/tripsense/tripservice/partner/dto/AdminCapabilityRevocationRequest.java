package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.PartnerCapability;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record AdminCapabilityRevocationRequest(
    @NotNull Long expectedVersion,
    @NotEmpty List<PartnerCapability> capabilities,
    @NotBlank String reason) {}
