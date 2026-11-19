package fu.tripsense.socialservice.dto.response;

import java.time.Instant;
import java.util.UUID;

public record AdminPlaceReviewStatusResponse(
    UUID id, String status, long pendingReportCount, Long version, Instant updatedAt) {}

