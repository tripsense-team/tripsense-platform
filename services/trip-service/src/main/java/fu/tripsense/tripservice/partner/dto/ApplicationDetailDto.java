package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.ApplicationState;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Builder;

@Builder
public record ApplicationDetailDto(
    UUID id,
    UUID businessId,
    Integer revision,
    Map<String, Object> profileSnapshot,
    String checklistId,
    String checklistVersion,
    List<String> requestedCapabilities,
    ApplicationState state,
    boolean isReverification,
    Long version,
    Long businessVersion,
    Instant submittedAt,
    Instant decidedAt,
    Instant createdAt,
    Instant updatedAt
) {}
