package fu.tripsense.tripservice.dto.request;

import fu.tripsense.tripservice.enums.ItineraryItemType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record AiItineraryCommitRequest(
    @NotNull Action action,
    UUID targetTripId,
    @NotNull UUID proposalId,
    @NotBlank @Pattern(regexp = "^[a-f0-9]{64}$") String proposalHash,
    @PositiveOrZero Long expectedTripRevision,
    @Valid TripDraft tripDraft,
    @NotNull @Size(max = 200) List<@Valid Item> items) {

  public enum Action {
    CREATE_TRIP,
    ADD_TO_TRIP
  }

  public record TripDraft(
      @NotBlank @Size(max = 160) String name,
      @NotBlank @Size(max = 255) String destinationName,
      @NotNull LocalDate startDate,
      @NotNull LocalDate endDate,
      @Min(1) @Max(100) Integer travelerCount,
      @DecimalMin("0.0") BigDecimal budgetAmount,
      @Pattern(regexp = "^[A-Z]{3}$") String budgetCurrency,
      @Size(max = 5000) String notes) {}

  public record Item(
      @NotNull UUID sourceItemKey,
      @Min(1) @Max(365) int dayNumber,
      @NotBlank @Size(max = 200) String title,
      @NotNull ItineraryItemType itemType,
      @Pattern(regexp = "^[A-Za-z0-9._:-]{1,200}$") String placeRef,
      LocalTime startTime,
      LocalTime endTime,
      @Size(max = 5000) String notes) {}
}
