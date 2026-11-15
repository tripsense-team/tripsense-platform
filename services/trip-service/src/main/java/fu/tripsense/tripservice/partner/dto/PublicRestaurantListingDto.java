package fu.tripsense.tripservice.partner.dto;

import java.util.List;
import java.util.UUID;
import lombok.Builder;

@Builder
public record PublicRestaurantListingDto(
    UUID id,
    UUID ownerUserId,
    String displayName,
    String address,
    String destination,
    String openingHours,
    List<String> cuisineTags,
    List<RestaurantMenuItemDto> menu,
    String publicEmail,
    String publicPhone,
    boolean verifiedPartner,
    boolean acceptingNew,
    String badgeLabel
) {}
