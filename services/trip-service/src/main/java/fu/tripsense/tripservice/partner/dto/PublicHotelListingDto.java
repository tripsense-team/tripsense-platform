package fu.tripsense.tripservice.partner.dto;

import java.math.BigDecimal;
import java.util.UUID;
import lombok.Builder;

@Builder
public record PublicHotelListingDto(
    UUID id,
    UUID ownerUserId,
    String displayName,
    String address,
    String destination,
    String checkInTime,
    String checkOutTime,
    String publicEmail,
    String publicPhone,
    boolean verifiedPartner,
    boolean acceptingNew,
    String badgeLabel,
    UUID propertyId,
    boolean hasDirectInventory,
    BigDecimal minPricePerNight
) {}

