package fu.tripsense.tripservice.partner.dto;

import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record PartnerSupportCaseDto(
    UUID id,
    String resourceType,
    UUID resourceId,
    UUID businessId,
    UUID reporterId,
    String category,
    String reason,
    String state,
    UUID assignedAdmin,
    String resolutionAction,
    String resolutionNote,
    Instant resolvedAt,
    Instant createdAt,
    Instant updatedAt
) {}
