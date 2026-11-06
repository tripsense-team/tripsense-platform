package fu.tripsense.socialservice.dto.response;

import java.time.Instant;
import java.util.UUID;

public record TripShareImportProjectionResponse(
    int schemaVersion,
    String payloadSha256,
    UUID postId,
    Instant publishedAt,
    PublicTripSnapshotResponse snapshot) {}
