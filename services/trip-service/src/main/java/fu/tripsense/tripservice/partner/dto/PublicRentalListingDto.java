package fu.tripsense.tripservice.partner.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lombok.Builder;

/** Public-facing rental business profile and active rental catalog. */
@Builder
public record PublicRentalListingDto(
    UUID id,
    UUID ownerUserId,
    String displayName,
    String address,
    String destination,
    String openingHours,
    String placeId,
    String publicEmail,
    String publicPhone,
    boolean verifiedPartner,
    boolean acceptingNew,
    String badgeLabel,
    boolean hasDirectInventory,
    BigDecimal minPricePerDay,
    List<RentalItemDto> items
) {}

