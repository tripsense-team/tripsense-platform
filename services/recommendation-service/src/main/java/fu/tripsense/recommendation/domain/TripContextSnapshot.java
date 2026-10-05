package fu.tripsense.recommendation.domain;

import java.time.LocalDate;
import java.util.UUID;

public record TripContextSnapshot(
    UUID tripId,
    String destinationName,
    String destinationPlaceRef,
    LocalDate startDate,
    LocalDate endDate,
    Integer travelerCount,
    String budgetCurrency) {}
