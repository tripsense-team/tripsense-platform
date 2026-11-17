package fu.tripsense.tripservice.partner.dto;

import java.math.BigDecimal;
import java.util.UUID;
import lombok.Builder;

@Builder
public record PublicHotelRoomDto(
    UUID id,
    UUID propertyId,
    String name,
    int capacity,
    BigDecimal pricePerNight,
    int availableRooms,
    String currency,
    String cancellationPolicy
) {}
