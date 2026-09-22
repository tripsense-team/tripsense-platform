package fu.tripsense.socialservice.dto.response;

import java.time.Instant;
import java.util.UUID;

public record ModerationReportResponse(
    UUID id,
    String targetType,
    UUID targetId,
    UUID postId,
    UUID reporterId,
    String reason,
    String details,
    String status,
    Instant createdAt,
    Instant reviewedAt,
    UUID reviewedBy,
    String moderatorNote) {}
