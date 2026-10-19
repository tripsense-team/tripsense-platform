package fu.tripsense.tripservice.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.OpeningIntervalDto;
import fu.tripsense.tripservice.partner.dto.RestaurantSlotDto;
import fu.tripsense.tripservice.partner.dto.UpdateRestaurantAvailabilityRequest;
import fu.tripsense.tripservice.partner.entity.RestaurantAvailability;
import fu.tripsense.tripservice.partner.entity.RestaurantOpeningInterval;
import fu.tripsense.tripservice.partner.entity.RestaurantReservation;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RestaurantAvailabilityEngineTest {

  private RestaurantAvailabilityEngine engine;
  private UUID businessId;
  private RestaurantAvailability defaultSettings;
  private List<RestaurantOpeningInterval> defaultIntervals;

  @BeforeEach
  void setUp() {
    engine = new RestaurantAvailabilityEngine();
    businessId = UUID.randomUUID();

    defaultSettings = RestaurantAvailability.builder()
        .businessId(businessId)
        .timeZone("Asia/Ho_Chi_Minh")
        .capacityGuests(20)
        .reservationDurationMinutes(90)
        .slotIntervalMinutes(30)
        .minimumLeadMinutes(60)
        .maximumAdvanceDays(90)
        .pendingHoldMinutes(30)
        .version(1L)
        .build();

    // Monday to Sunday: 10:00 - 14:00 and 17:00 - 22:00
    defaultIntervals = new ArrayList<>();
    for (int day = 1; day <= 7; day++) {
      defaultIntervals.add(RestaurantOpeningInterval.builder()
          .id(UUID.randomUUID())
          .businessId(businessId)
          .dayOfWeek(day)
          .opensAt(LocalTime.of(10, 0))
          .closesAt(LocalTime.of(14, 0))
          .build());
      defaultIntervals.add(RestaurantOpeningInterval.builder()
          .id(UUID.randomUUID())
          .businessId(businessId)
          .dayOfWeek(day)
          .opensAt(LocalTime.of(17, 0))
          .closesAt(LocalTime.of(22, 0))
          .build());
    }
  }

  @Test
  @DisplayName("Generates slots properly inside operating intervals without exceeding interval close")
  void testGenerateSlots() {
    LocalDate date = LocalDate.of(2026, 10, 20); // Tuesday
    Instant now = ZonedDateTime.of(date, LocalTime.of(8, 0), ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();

    List<RestaurantSlotDto> slots = engine.generateAvailableSlots(
        defaultSettings, defaultIntervals, date, 4, now, Collections.emptyList());

    // 10:00 - 14:00 (duration 90m): 10:00-11:30, 10:30-12:00, 11:00-12:30, 11:30-13:00, 12:00-13:30, 12:30-14:00 -> 6 slots
    // 17:00 - 22:00 (duration 90m): 17:00, 17:30, 18:00, 18:30, 19:00, 19:30, 20:00, 20:30 -> 8 slots
    assertThat(slots).hasSize(14);
    assertThat(slots.get(0).startsAt())
        .isEqualTo(ZonedDateTime.of(date, LocalTime.of(10, 0), ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
  }

  @Test
  @DisplayName("Adjacent bookings do not overlap or sum up against capacity")
  void testAdjacentBookingsDoNotOverlap() {
    LocalDate date = LocalDate.of(2026, 10, 20);
    ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");

    Instant booking1Start = ZonedDateTime.of(date, LocalTime.of(10, 0), zone).toInstant();
    Instant booking1End = ZonedDateTime.of(date, LocalTime.of(11, 30), zone).toInstant();

    Instant booking2Start = ZonedDateTime.of(date, LocalTime.of(11, 30), zone).toInstant();
    Instant booking2End = ZonedDateTime.of(date, LocalTime.of(13, 0), zone).toInstant();

    RestaurantReservation r1 = RestaurantReservation.builder()
        .id(UUID.randomUUID())
        .businessId(businessId)
        .startAt(booking1Start)
        .endsAt(booking1End)
        .adults(15)
        .children(0)
        .state("CONFIRMED")
        .build();

    RestaurantReservation r2 = RestaurantReservation.builder()
        .id(UUID.randomUUID())
        .businessId(businessId)
        .startAt(booking2Start)
        .endsAt(booking2End)
        .adults(15)
        .children(0)
        .state("CONFIRMED")
        .build();

    // Check peak occupancy across 10:00 to 13:00: peak should be 15, not 30!
    int peak = engine.calculatePeakOccupancy(booking1Start, booking2End, List.of(r1, r2), null);
    assertThat(peak).isEqualTo(15);
  }

  @Test
  @DisplayName("Overlapping bookings sum up accurately against capacity")
  void testOverlappingBookingsSumCapacity() {
    LocalDate date = LocalDate.of(2026, 10, 20);
    ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");

    Instant b1Start = ZonedDateTime.of(date, LocalTime.of(11, 0), zone).toInstant();
    Instant b1End = ZonedDateTime.of(date, LocalTime.of(12, 30), zone).toInstant();

    Instant b2Start = ZonedDateTime.of(date, LocalTime.of(11, 30), zone).toInstant();
    Instant b2End = ZonedDateTime.of(date, LocalTime.of(13, 0), zone).toInstant();

    RestaurantReservation r1 = RestaurantReservation.builder()
        .id(UUID.randomUUID())
        .businessId(businessId)
        .startAt(b1Start)
        .endsAt(b1End)
        .adults(10)
        .children(2)
        .state("CONFIRMED")
        .build();

    RestaurantReservation r2 = RestaurantReservation.builder()
        .id(UUID.randomUUID())
        .businessId(businessId)
        .startAt(b2Start)
        .endsAt(b2End)
        .adults(6)
        .children(0)
        .state("CONFIRMED")
        .build();

    // Overlap from 11:30 to 12:30 has 12 + 6 = 18 guests
    int peak = engine.calculatePeakOccupancy(b1Start, b2End, List.of(r1, r2), null);
    assertThat(peak).isEqualTo(18);

    // Candidate for 4 guests would push peak to 22 (> 20 capacity) -> throws RESTAURANT_SLOT_UNAVAILABLE
    Instant candidateStart = ZonedDateTime.of(date, LocalTime.of(11, 30), zone).toInstant();
    Instant candidateEnd = candidateStart.plusSeconds(90 * 60);

    Instant now = ZonedDateTime.of(date, LocalTime.of(8, 0), zone).toInstant();

    assertThatThrownBy(() -> engine.validateCandidate(
        defaultSettings, defaultIntervals, candidateStart, candidateEnd, 4, now, List.of(r1, r2), null))
        .isInstanceOf(TripServiceException.class)
        .hasMessageContaining("insufficient capacity");
  }

  @Test
  @DisplayName("Validates candidate outside opening hours throws RESTAURANT_OUTSIDE_HOURS")
  void testCandidateOutsideHours() {
    LocalDate date = LocalDate.of(2026, 10, 20);
    ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");

    // 15:00 is between lunch (10-14) and dinner (17-22)
    Instant candidateStart = ZonedDateTime.of(date, LocalTime.of(15, 0), zone).toInstant();
    Instant candidateEnd = candidateStart.plusSeconds(90 * 60);
    Instant now = ZonedDateTime.of(date, LocalTime.of(8, 0), zone).toInstant();

    assertThatThrownBy(() -> engine.validateCandidate(
        defaultSettings, defaultIntervals, candidateStart, candidateEnd, 2, now, Collections.emptyList(), null))
        .isInstanceOf(TripServiceException.class)
        .hasMessageContaining("operating hours");
  }

  @Test
  @DisplayName("Validating candidate inside lead time window throws RESTAURANT_BOOKING_WINDOW_CLOSED")
  void testCandidateViolatesLeadTime() {
    LocalDate date = LocalDate.of(2026, 10, 20);
    ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");

    Instant now = ZonedDateTime.of(date, LocalTime.of(10, 0), zone).toInstant();
    // Start at 10:30 (lead time is 60m, so min allowed is 11:00)
    Instant candidateStart = ZonedDateTime.of(date, LocalTime.of(10, 30), zone).toInstant();
    Instant candidateEnd = candidateStart.plusSeconds(90 * 60);

    assertThatThrownBy(() -> engine.validateCandidate(
        defaultSettings, defaultIntervals, candidateStart, candidateEnd, 2, now, Collections.emptyList(), null))
        .isInstanceOf(TripServiceException.class)
        .hasMessageContaining("minimum lead time");
  }

  @Test
  @DisplayName("Validate intervals detects overlapping intervals on the same day")
  void testValidateIntervalsDetectsOverlaps() {
    List<OpeningIntervalDto> intervals = List.of(
        OpeningIntervalDto.builder().dayOfWeek(1).opensAt(LocalTime.of(10, 0)).closesAt(LocalTime.of(14, 0)).build(),
        OpeningIntervalDto.builder().dayOfWeek(1).opensAt(LocalTime.of(13, 30)).closesAt(LocalTime.of(18, 0)).build()
    );

    assertThatThrownBy(() -> engine.validateIntervals(intervals))
        .isInstanceOf(TripServiceException.class)
        .hasMessageContaining("Overlapping opening intervals");
  }

  @Test
  @DisplayName("Validate settings update rejects changes that conflict with future reservations")
  void testSettingsUpdateConflict() {
    LocalDate date = LocalDate.of(2026, 10, 25);
    ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");

    Instant futureStart = ZonedDateTime.of(date, LocalTime.of(11, 0), zone).toInstant();
    Instant futureEnd = futureStart.plusSeconds(90 * 60);

    RestaurantReservation futureBooking = RestaurantReservation.builder()
        .id(UUID.randomUUID())
        .businessId(businessId)
        .startAt(futureStart)
        .endsAt(futureEnd)
        .adults(15)
        .children(0)
        .state("CONFIRMED")
        .build();

    // Trying to lower capacity to 10
    UpdateRestaurantAvailabilityRequest updateReq = UpdateRestaurantAvailabilityRequest.builder()
        .expectedVersion(1L)
        .timeZone("Asia/Ho_Chi_Minh")
        .capacityGuests(10) // Lower than 15!
        .reservationDurationMinutes(90)
        .slotIntervalMinutes(30)
        .minimumLeadMinutes(60)
        .maximumAdvanceDays(90)
        .pendingHoldMinutes(30)
        .openingIntervals(List.of(
            OpeningIntervalDto.builder().dayOfWeek(7).opensAt(LocalTime.of(10, 0)).closesAt(LocalTime.of(22, 0)).build()
        ))
        .build();

    assertThatThrownBy(() -> engine.validateSettingsUpdateAgainstFutureReservations(updateReq, List.of(futureBooking)))
        .isInstanceOf(TripServiceException.class)
        .hasMessageContaining("lower than existing reservation");
  }
}
