package fu.tripsense.socialservice.dto.response;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record SharedTripSummaryResponse(
    String name,
    String destinationName,
    LocalDate startDate,
    LocalDate endDate,
    String coverImageUrl,
    Integer dayCount,
    Integer itineraryItemCount,
    List<SharedTripHighlightResponse> highlights,
    Long publicationRevision,
    Instant publishedAt,
    Instant refreshedAt,
    String detailAvailability,
    String datePrecision) {}
