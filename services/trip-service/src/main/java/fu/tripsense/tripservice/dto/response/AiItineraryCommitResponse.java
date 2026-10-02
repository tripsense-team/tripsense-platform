package fu.tripsense.tripservice.dto.response;

import java.util.List;
import java.util.UUID;

public record AiItineraryCommitResponse(
    UUID operationId,
    String status,
    String action,
    UUID tripId,
    String tripName,
    long tripRevision,
    int appliedCount,
    int skippedCount,
    List<ItemResult> items,
    boolean replayed) {

  public record ItemResult(UUID itemKey, UUID itineraryItemId, String status) {}
}
