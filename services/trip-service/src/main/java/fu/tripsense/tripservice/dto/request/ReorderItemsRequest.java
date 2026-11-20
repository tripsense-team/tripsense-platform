package fu.tripsense.tripservice.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record ReorderItemsRequest(
    @NotEmpty List<UUID> orderedItemIds,
    @NotNull Long version,
    Long expectedTripRevision,
    Boolean preserveTimes) {
  public ReorderItemsRequest(List<UUID> orderedItemIds, Long version) {
    this(orderedItemIds, version, null, false);
  }

  public ReorderItemsRequest(List<UUID> orderedItemIds, Long version, Long expectedTripRevision) {
    this(orderedItemIds, version, expectedTripRevision, false);
  }
}
