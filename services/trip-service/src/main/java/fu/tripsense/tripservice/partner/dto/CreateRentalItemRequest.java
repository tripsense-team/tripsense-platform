package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.PickupOption;
import fu.tripsense.tripservice.partner.enums.RentalCategory;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import lombok.Builder;

@Builder
public record CreateRentalItemRequest(
    @NotBlank String name,
    @NotNull RentalCategory category,
    String subcategory,
    String description,
    String thumbnailUrl,
    List<String> images,
    @NotNull @DecimalMin("0.0") BigDecimal pricePerDay,
    BigDecimal pricePerHour,
    BigDecimal depositAmount,
    String depositPolicy,
    @Min(1) Integer totalInventory,
    Boolean deliveryAvailable,
    BigDecimal deliveryFee,
    PickupOption pickupOption,
    Map<String, Object> specifications
) {}
