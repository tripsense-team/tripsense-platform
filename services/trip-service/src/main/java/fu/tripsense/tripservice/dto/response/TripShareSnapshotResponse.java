package fu.tripsense.tripservice.dto.response;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record TripShareSnapshotResponse(
    UUID tripId,
    String name,
    String destinationName,
    LocalDate startDate,
    LocalDate endDate,
    String coverImageUrl,
    Integer dayCount,
    Integer itineraryItemCount,
    List<TripShareHighlightResponse> highlights,
    Instant updatedAt) {}
