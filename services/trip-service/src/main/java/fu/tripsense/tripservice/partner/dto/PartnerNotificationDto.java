package fu.tripsense.tripservice.partner.dto;

import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record PartnerNotificationDto(
    UUID id,
    UUID eventId,
    String eventType,
    UUID businessId,
    String message,
    Instant readAt,
    Instant createdAt
) {}
