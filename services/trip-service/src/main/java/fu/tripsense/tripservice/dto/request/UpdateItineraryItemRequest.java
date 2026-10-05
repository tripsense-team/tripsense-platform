package fu.tripsense.tripservice.dto.request;

import fu.tripsense.tripservice.enums.ItineraryItemStatus;
import fu.tripsense.tripservice.enums.ItineraryItemType;
import jakarta.validation.constraints.*;
import java.time.LocalTime;
import java.util.UUID;

public record UpdateItineraryItemRequest(
    UUID placeId,
    String placeRef,
    ItineraryItemType type,
    @Size(max = 200) String title,
    LocalTime startTime,
    LocalTime endTime,
    @Min(1) @Max(1440) Integer durationMinutes,
    ItineraryItemStatus status,
    @Size(max = 5000) String notes,
    Long version,
    Long expectedTripRevision) {
  public UpdateItineraryItemRequest(
      UUID placeId,
      ItineraryItemType type,
      String title,
      LocalTime startTime,
      LocalTime endTime,
      Integer durationMinutes,
      ItineraryItemStatus status,
      String notes,
      Long version) {
    this(placeId, null, type, title, startTime, endTime, durationMinutes, status, notes, version, null);
  }

  public UpdateItineraryItemRequest(
      UUID placeId,
      String placeRef,
      ItineraryItemType type,
      String title,
      LocalTime startTime,
      LocalTime endTime,
      Integer durationMinutes,
      ItineraryItemStatus status,
      String notes,
      Long version) {
    this(placeId, placeRef, type, title, startTime, endTime, durationMinutes, status, notes, version, null);
  }

  public String effectivePlaceRef() {
    if (placeRef != null && !placeRef.isBlank()) {
      return placeRef;
    }
    return placeId != null ? placeId.toString() : null;
  }
}
