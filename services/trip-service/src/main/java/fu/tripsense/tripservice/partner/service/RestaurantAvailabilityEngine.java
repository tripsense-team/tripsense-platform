package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.OpeningIntervalDto;
import fu.tripsense.tripservice.partner.dto.RestaurantSlotDto;
import fu.tripsense.tripservice.partner.dto.UpdateRestaurantAvailabilityRequest;
import fu.tripsense.tripservice.partner.entity.RestaurantAvailability;
import fu.tripsense.tripservice.partner.entity.RestaurantOpeningInterval;
import fu.tripsense.tripservice.partner.entity.RestaurantReservation;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class RestaurantAvailabilityEngine {

  /**
   * Generates bookable slots for a single local date and party size.
   */
  public List<RestaurantSlotDto> generateAvailableSlots(
      RestaurantAvailability settings,
      List<RestaurantOpeningInterval> intervals,
      LocalDate date,
      int partySize,
      Instant now,
      List<RestaurantReservation> activeReservations) {

    if (partySize < 1 || partySize > settings.getCapacityGuests()) {
      return Collections.emptyList();
    }

    ZoneId zone = ZoneId.of(settings.getTimeZone());
    int dayOfWeek = date.getDayOfWeek().getValue();
    int duration = settings.getReservationDurationMinutes();
    int slotInterval = settings.getSlotIntervalMinutes();

    List<RestaurantOpeningInterval> dayIntervals = intervals.stream()
        .filter(i -> i.getDayOfWeek() == dayOfWeek)
        .sorted(Comparator.comparing(RestaurantOpeningInterval::getOpensAt))
        .toList();

    if (dayIntervals.isEmpty()) {
      return Collections.emptyList();
    }

    Instant minAllowedStart = now.plus(settings.getMinimumLeadMinutes(), ChronoUnit.MINUTES);
    Instant maxAllowedStart = now.plus(settings.getMaximumAdvanceDays(), ChronoUnit.DAYS);

    List<RestaurantSlotDto> result = new ArrayList<>();

    for (RestaurantOpeningInterval interval : dayIntervals) {
      LocalTime current = interval.getOpensAt();
      LocalTime closesAt = interval.getClosesAt();

      while (!current.plusMinutes(duration).isAfter(closesAt)) {
        LocalTime slotEndLocal = current.plusMinutes(duration);
        ZonedDateTime startZdt = ZonedDateTime.of(date, current, zone);
        ZonedDateTime endZdt = ZonedDateTime.of(date, slotEndLocal, zone);

        Instant startInstant = startZdt.toInstant();
        Instant endInstant = endZdt.toInstant();

        // Check booking window limits
        boolean inWindow = !startInstant.isBefore(minAllowedStart) && !startInstant.isAfter(maxAllowedStart);

        if (inWindow) {
          int peakGuests = calculatePeakOccupancy(startInstant, endInstant, activeReservations, null);
          if (peakGuests + partySize <= settings.getCapacityGuests()) {
            result.add(RestaurantSlotDto.builder()
                .startsAt(startInstant)
                .endsAt(endInstant)
                .available(true)
                .build());
          }
        }

        // Avoid infinite loop if interval is 0
        if (slotInterval <= 0) {
          break;
        }
        current = current.plusMinutes(slotInterval);
      }
    }

    return result;
  }

  /**
   * Validates a candidate reservation against restaurant availability rules and capacity.
   * Throws TripServiceException with stable domain codes if validation fails.
   */
  public void validateCandidate(
      RestaurantAvailability settings,
      List<RestaurantOpeningInterval> intervals,
      Instant startAt,
      Instant endsAt,
      int partySize,
      Instant now,
      List<RestaurantReservation> activeReservations,
      UUID excludeReservationId) {

    if (partySize < 1 || partySize > settings.getCapacityGuests()) {
      throw new TripServiceException(
          "INVALID_GUESTS",
          "Party size exceeds maximum restaurant capacity of " + settings.getCapacityGuests(),
          HttpStatus.BAD_REQUEST);
    }

    Instant minAllowedStart = now.plus(settings.getMinimumLeadMinutes(), ChronoUnit.MINUTES);
    Instant maxAllowedStart = now.plus(settings.getMaximumAdvanceDays(), ChronoUnit.DAYS);

    if (startAt.isBefore(minAllowedStart)) {
      throw new TripServiceException(
          "RESTAURANT_BOOKING_WINDOW_CLOSED",
          "Reservation does not meet minimum lead time requirement of " + settings.getMinimumLeadMinutes() + " minutes",
          HttpStatus.CONFLICT);
    }

    if (startAt.isAfter(maxAllowedStart)) {
      throw new TripServiceException(
          "RESTAURANT_BOOKING_WINDOW_CLOSED",
          "Reservation exceeds maximum advance booking window of " + settings.getMaximumAdvanceDays() + " days",
          HttpStatus.CONFLICT);
    }

    ZoneId zone = ZoneId.of(settings.getTimeZone());
    ZonedDateTime startZdt = startAt.atZone(zone);
    ZonedDateTime endZdt = endsAt.atZone(zone);

    if (!startZdt.toLocalDate().equals(endZdt.toLocalDate())) {
      throw new TripServiceException(
          "RESTAURANT_OUTSIDE_HOURS",
          "Reservation spans across multiple days which is not supported",
          HttpStatus.CONFLICT);
    }

    int dayOfWeek = startZdt.getDayOfWeek().getValue();
    LocalTime localStart = startZdt.toLocalTime();
    LocalTime localEnd = endZdt.toLocalTime();

    boolean fitsInsideOpeningInterval = intervals.stream()
        .filter(i -> i.getDayOfWeek() == dayOfWeek)
        .anyMatch(i -> !localStart.isBefore(i.getOpensAt()) && !localEnd.isAfter(i.getClosesAt()));

    if (!fitsInsideOpeningInterval) {
      throw new TripServiceException(
          "RESTAURANT_OUTSIDE_HOURS",
          "Requested time slot is outside restaurant operating hours",
          HttpStatus.CONFLICT);
    }

    int peakGuests = calculatePeakOccupancy(startAt, endsAt, activeReservations, excludeReservationId);
    if (peakGuests + partySize > settings.getCapacityGuests()) {
      throw new TripServiceException(
          "RESTAURANT_SLOT_UNAVAILABLE",
          "Requested time slot has insufficient capacity for " + partySize + " guests",
          HttpStatus.CONFLICT);
    }
  }

  /**
   * Calculates the peak occupancy of active reservations across [rangeStart, rangeEnd).
   * Half-open intervals: reservation [start, end) occupies time t if start <= t < end.
   */
  public int calculatePeakOccupancy(
      Instant rangeStart,
      Instant rangeEnd,
      List<RestaurantReservation> activeReservations,
      UUID excludeReservationId) {

    List<RestaurantReservation> relevant = activeReservations.stream()
        .filter(r -> excludeReservationId == null || !r.getId().equals(excludeReservationId))
        .filter(r -> r.getStartAt() != null && r.getEndsAt() != null)
        .filter(r -> r.getStartAt().isBefore(rangeEnd) && r.getEndsAt().isAfter(rangeStart))
        .toList();

    if (relevant.isEmpty()) {
      return 0;
    }

    // Collect discrete check points: rangeStart plus any reservation start point within [rangeStart, rangeEnd)
    TreeSet<Instant> checkPoints = new TreeSet<>();
    checkPoints.add(rangeStart);

    for (RestaurantReservation r : relevant) {
      if (!r.getStartAt().isBefore(rangeStart) && r.getStartAt().isBefore(rangeEnd)) {
        checkPoints.add(r.getStartAt());
      }
    }

    int maxLoad = 0;
    for (Instant t : checkPoints) {
      int loadAtT = 0;
      for (RestaurantReservation r : relevant) {
        if (!t.isBefore(r.getStartAt()) && t.isBefore(r.getEndsAt())) {
          loadAtT += (r.getAdults() + r.getChildren());
        }
      }
      if (loadAtT > maxLoad) {
        maxLoad = loadAtT;
      }
    }

    return maxLoad;
  }

  /**
   * Validates that new settings and intervals do not violate any existing future active reservations.
   */
  public void validateSettingsUpdateAgainstFutureReservations(
      UpdateRestaurantAvailabilityRequest request,
      List<RestaurantReservation> futureActiveReservations) {

    ZoneId newZone;
    try {
      newZone = ZoneId.of(request.timeZone());
    } catch (DateTimeException e) {
      throw new TripServiceException("INVALID_TIME_ZONE", "Invalid IANA time zone", HttpStatus.BAD_REQUEST);
    }

    for (RestaurantReservation res : futureActiveReservations) {
      int guests = res.getAdults() + res.getChildren();
      if (guests > request.capacityGuests()) {
        throw new TripServiceException(
            "RESTAURANT_SETTINGS_CONFLICT",
            "Updated capacity (" + request.capacityGuests() + ") is lower than existing reservation for "
                + guests + " guests at " + res.getStartAt(),
            HttpStatus.CONFLICT);
      }

      Instant start = res.getStartAt();
      Instant end = res.getEndsAt() != null ? res.getEndsAt()
          : start.plus(request.reservationDurationMinutes(), ChronoUnit.MINUTES);

      ZonedDateTime startZdt = start.atZone(newZone);
      ZonedDateTime endZdt = end.atZone(newZone);

      int dayOfWeek = startZdt.getDayOfWeek().getValue();
      LocalTime startLocal = startZdt.toLocalTime();
      LocalTime endLocal = endZdt.toLocalTime();

      boolean covered = request.openingIntervals().stream()
          .filter(i -> i.dayOfWeek() == dayOfWeek)
          .anyMatch(i -> !startLocal.isBefore(i.opensAt()) && !endLocal.isAfter(i.closesAt()));

      if (!covered) {
        throw new TripServiceException(
            "RESTAURANT_SETTINGS_CONFLICT",
            "Existing reservation at " + start + " falls outside new operating hours",
            HttpStatus.CONFLICT);
      }
    }
  }

  /**
   * Validates opening interval definitions:
   * 1 <= dayOfWeek <= 7, opensAt < closesAt, no overlapping intervals on the same day.
   */
  public void validateIntervals(List<OpeningIntervalDto> intervals) {
    if (intervals == null || intervals.isEmpty()) {
      return;
    }

    Map<Integer, List<OpeningIntervalDto>> byDay = new HashMap<>();
    for (OpeningIntervalDto dto : intervals) {
      if (dto.dayOfWeek() < 1 || dto.dayOfWeek() > 7) {
        throw new TripServiceException("INVALID_OPENING_HOURS", "Day of week must be between 1 and 7", HttpStatus.BAD_REQUEST);
      }
      if (!dto.opensAt().isBefore(dto.closesAt())) {
        throw new TripServiceException("INVALID_OPENING_HOURS", "opensAt must be before closesAt", HttpStatus.BAD_REQUEST);
      }
      byDay.computeIfAbsent(dto.dayOfWeek(), k -> new ArrayList<>()).add(dto);
    }

    for (List<OpeningIntervalDto> dayList : byDay.values()) {
      dayList.sort(Comparator.comparing(OpeningIntervalDto::opensAt));
      for (int i = 0; i < dayList.size() - 1; i++) {
        OpeningIntervalDto curr = dayList.get(i);
        OpeningIntervalDto next = dayList.get(i + 1);
        if (curr.closesAt().isAfter(next.opensAt())) {
          throw new TripServiceException(
              "INVALID_OPENING_HOURS",
              "Overlapping opening intervals on day " + curr.dayOfWeek(),
              HttpStatus.BAD_REQUEST);
        }
      }
    }
  }
}
