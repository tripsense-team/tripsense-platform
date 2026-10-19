package fu.tripsense.tripservice.partner.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record PartnerAnalyticsSummaryDto(
    UUID businessId,
    String timeZone,
    Period period,
    Metrics current,
    Metrics previous,
    ExpectedGuests expectedGuests,
    Instant generatedAt) {

  public record Period(int days, LocalDate from, LocalDate toExclusive) {}

  public record Rate(long numerator, long denominator, double value) {}

  public record Metrics(long views, long reservationRequests, Rate confirmationRate, Rate cancellationRate) {}

  public record ExpectedGuests(long count, Instant from, Instant toExclusive) {}
}
