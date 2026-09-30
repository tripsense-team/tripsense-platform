package fu.tripsense.placeservice.dto;

import java.time.Instant;
import java.util.UUID;

public record PlaceCollectionDto(
    UUID id,
    String name,
    long placeCount,
    Long version,
    Instant createdAt,
    Instant updatedAt) {}
