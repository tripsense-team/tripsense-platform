package fu.tripsense.tripservice.dto.response;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record AdminTripPageResponse(
    List<AdminTripItem> items,
    int page,
    int size,
    long totalElements,
    int totalPages,
    Summary summary) {

  public record Summary(
      long totalTrips,
      long activeTrips,
      long archivedTrips,
      long aiCraftedTrips,
      long publicTrips) {}

  public record AdminTripItem(
      UUID id,
      UUID ownerUserId,
      String name,
      String destinationName,
      LocalDate startDate,
      LocalDate endDate,
      int durationDays,
      String status,
      String visibility,
      Integer travelerCount,
      long spotsCount,
      boolean isAiGenerated,
      boolean archived,
      Instant archivedAt,
      Long version,
      Instant createdAt,
      Instant updatedAt) {}
}

