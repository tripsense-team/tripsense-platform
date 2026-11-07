package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.PickupOption;
import fu.tripsense.tripservice.partner.enums.RentalCategory;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Builder;

@Builder
public record RentalItemDto(
    UUID id,
    UUID businessId,
    String name,
    RentalCategory category,
    String subcategory,
    String description,
    String thumbnailUrl,
    List<String> images,
    BigDecimal pricePerDay,
    BigDecimal pricePerHour,
    BigDecimal depositAmount,
    String depositPolicy,
    int totalInventory,
    boolean deliveryAvailable,
    BigDecimal deliveryFee,
    PickupOption pickupOption,
    Map<String, Object> specifications,
    boolean active,
    Instant createdAt,
    Instant updatedAt
) {}
