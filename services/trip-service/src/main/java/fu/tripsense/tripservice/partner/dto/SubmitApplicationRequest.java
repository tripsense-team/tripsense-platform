package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.PartnerCapability;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record SubmitApplicationRequest(
    @NotNull Long expectedVersion,
    String checklistId,
    String checklistVersion,
    @NotNull List<PartnerCapability> requestedCapabilities,
    Map<String, Object> profileSnapshot,
    List<UUID> documentIds
) {}
