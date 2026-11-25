package fu.tripsense.tripservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ReplaceDayItemsRequest(
    @NotNull @Size(max = 50) List<@Valid CreateItineraryItemRequest> items,
    Long version,
    Long expectedTripRevision) {
  public ReplaceDayItemsRequest(List<CreateItineraryItemRequest> items) {
    this(items, null, null);
  }
}
