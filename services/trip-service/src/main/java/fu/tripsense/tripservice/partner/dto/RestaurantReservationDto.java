package fu.tripsense.tripservice.partner.dto;

import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record RestaurantReservationDto(
    UUID id,
    UUID businessId,
    String businessName,
    UUID customerId,
    String customerEmail,
    String customerName,
    Instant startAt,
    String timeZone,
    int adults,
    int children,
    String notes,
    String state,
    String cancellationReason,
    String decisionReason,
    Long version,
    Instant createdAt,
    Instant updatedAt
) {}
