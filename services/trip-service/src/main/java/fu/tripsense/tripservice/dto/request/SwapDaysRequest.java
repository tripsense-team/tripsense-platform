package fu.tripsense.tripservice.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record SwapDaysRequest(
    @NotNull @Min(1) @Max(365) Integer firstDayNumber,
    @NotNull @Min(1) @Max(365) Integer secondDayNumber,
    Long expectedTripRevision) {
  public SwapDaysRequest(Integer firstDayNumber, Integer secondDayNumber) {
    this(firstDayNumber, secondDayNumber, null);
  }
}
