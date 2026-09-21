package fu.tripsense.tripservice.dto.response;

import java.time.Instant;
import java.util.UUID;

public record ItineraryBatchResponse(
        UUID receiptId,
        UUID tripId,
        String proposalId,
        long tripRevision,
        int appliedOperationCount,
        Instant appliedAt,
        boolean replayed
) {
}
