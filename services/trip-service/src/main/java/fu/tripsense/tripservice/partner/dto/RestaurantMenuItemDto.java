package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lombok.Builder;

@Builder
public record RestaurantMenuItemDto(
    UUID id,
    @NotBlank @Size(max = 160) String name,
    @Size(max = 80) String category,
    @Size(max = 500) String description,
    @NotNull @DecimalMin("0.01") BigDecimal price,
    @Size(max = 3) String currency,
    List<String> tags,
    boolean available,
    int displayOrder
) {}
