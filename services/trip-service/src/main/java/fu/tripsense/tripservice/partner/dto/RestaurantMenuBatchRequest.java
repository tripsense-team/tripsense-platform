package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record RestaurantMenuBatchRequest(
    @NotNull @Valid List<RestaurantMenuItemDto> items,
    Long expectedVersion
) {
  public RestaurantMenuBatchRequest(List<RestaurantMenuItemDto> items) {
    this(items, null);
  }
}
