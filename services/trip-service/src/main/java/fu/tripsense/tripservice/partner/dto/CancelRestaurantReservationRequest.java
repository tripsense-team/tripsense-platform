package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CancelRestaurantReservationRequest(
    @NotNull Long expectedVersion,
    @Size(max = 500) String reason
) {
  public CancelRestaurantReservationRequest(Long expectedVersion) {
    this(expectedVersion, null);
  }
}
