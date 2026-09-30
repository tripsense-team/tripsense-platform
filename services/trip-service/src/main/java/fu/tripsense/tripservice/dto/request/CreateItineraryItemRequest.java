package fu.tripsense.tripservice.dto.request;

import fu.tripsense.tripservice.enums.ItineraryItemType;
import jakarta.validation.constraints.*;
import java.time.LocalTime;
import java.util.UUID;

public record CreateItineraryItemRequest(
    UUID placeId,
    String placeRef,
    @NotNull ItineraryItemType type,
    @NotBlank @Size(max = 200) String title,
    LocalTime startTime,
    LocalTime endTime,
    @Min(1) @Max(1440) Integer durationMinutes,
    @Size(max = 5000) String notes,
    Long expectedTripRevision) {
  public CreateItineraryItemRequest(
      UUID placeId,
      ItineraryItemType type,
      String title,
      LocalTime startTime,
      LocalTime endTime,
      Integer durationMinutes,
      String notes) {
    this(placeId, null, type, title, startTime, endTime, durationMinutes, notes, null);
  }

  public CreateItineraryItemRequest(
      UUID placeId,
      String placeRef,
      ItineraryItemType type,
      String title,
      LocalTime startTime,
      LocalTime endTime,
      Integer durationMinutes,
      String notes) {
    this(placeId, placeRef, type, title, startTime, endTime, durationMinutes, notes, null);
  }

  public String effectivePlaceRef() {
    if (placeRef != null && !placeRef.isBlank()) {
      return placeRef;
    }
    return placeId != null ? placeId.toString() : null;
  }
}
