package fu.tripsense.tripservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.client.PlaceClient;
import fu.tripsense.tripservice.dto.response.PublicTripPublicationResponse;
import fu.tripsense.tripservice.entity.ItineraryDay;
import fu.tripsense.tripservice.entity.ItineraryItem;
import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.enums.ItineraryItemType;
import fu.tripsense.tripservice.enums.TripStatus;
import fu.tripsense.tripservice.repository.ItineraryDayRepository;
import fu.tripsense.tripservice.repository.ItineraryItemRepository;
import fu.tripsense.tripservice.repository.TripMemberRepository;
import fu.tripsense.tripservice.repository.TripRepository;
import fu.tripsense.tripservice.service.impl.TripServiceImpl;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PublicTripSnapshotServiceTest {
  private final UUID userId = UUID.randomUUID();
  private final UUID tripId = UUID.randomUUID();
  private TripRepository trips;
  private ItineraryDayRepository days;
  private ItineraryItemRepository items;
  private TripMemberRepository tripMembers;
  private PlaceClient placeClient;
  private TripService service;

  @BeforeEach
  void setUp() {
    trips = mock(TripRepository.class);
    days = mock(ItineraryDayRepository.class);
    items = mock(ItineraryItemRepository.class);
    tripMembers = mock(TripMemberRepository.class);
    placeClient = mock(PlaceClient.class);
    service =
        new TripServiceImpl(
            trips,
            days,
            items,
            tripMembers,
            placeClient,
            Clock.fixed(Instant.parse("2026-09-22T00:00:00Z"), ZoneOffset.UTC),
            new ObjectMapper().findAndRegisterModules(),
            mock(CollaborationChangeService.class));
  }

  @Test
  void futureTripProjectionIsDeterministicAndRedactsPrivateFields() {
    Trip trip = trip(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2));
    ItineraryDay day = day(1, LocalDate.of(2026, 10, 1));
    ItineraryItem place = item("Dragon Bridge", ItineraryItemType.PLACE, 1000);
    place.setPlaceNameSnapshot("Dragon Bridge");
    place.setPlaceAddressSnapshot("private address");
    place.setLatSnapshot(BigDecimal.ONE);
    place.setLngSnapshot(BigDecimal.TEN);
    place.setNotes("private note");
    place.setStartTime(LocalTime.of(8, 30));
    ItineraryItem hotel = item("Secret Hotel", ItineraryItemType.HOTEL, 2000);
    ItineraryItem note = item("Passport number", ItineraryItemType.NOTE, 3000);
    stub(trip, day, List.of(place, hotel, note));

    PublicTripPublicationResponse first = service.getPublicationSnapshot(userId, tripId);
    PublicTripPublicationResponse second = service.getPublicationSnapshot(userId, tripId);

    assertThat(first.snapshotFingerprint()).isEqualTo(second.snapshotFingerprint()).hasSize(64);
    assertThat(first.snapshot().datePrecision()).isEqualTo("DAY_NUMBER_ONLY");
    assertThat(first.snapshot().days().getFirst().date()).isNull();
    assertThat(first.snapshot().days().getFirst().items()).hasSize(2);
    assertThat(first.snapshot().days().getFirst().items().getFirst().startTime()).isNull();
    assertThat(first.snapshot().days().getFirst().items().get(1).title()).isEqualTo("Nơi lưu trú");
    assertThat(first.snapshot().days().getFirst().items().get(1).placeName()).isNull();
    assertThat(first.warnings())
        .contains("EXACT_DATES_AND_TIMES_HIDDEN", "PRIVATE_DETAILS_REDACTED");
  }

  @Test
  void endedTripCanPublishExactDateAndTime() {
    Trip trip = trip(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 2));
    ItineraryDay day = day(1, LocalDate.of(2026, 9, 1));
    ItineraryItem place = item("Museum", ItineraryItemType.ACTIVITY, 1000);
    place.setStartTime(LocalTime.of(9, 0));
    place.setEndTime(LocalTime.of(10, 0));
    place.setDurationMinutes(60);
    stub(trip, day, List.of(place));

    var snapshot = service.getPublicationSnapshot(userId, tripId).snapshot();

    assertThat(snapshot.datePrecision()).isEqualTo("EXACT");
    assertThat(snapshot.days().getFirst().date()).isEqualTo(LocalDate.of(2026, 9, 1));
    assertThat(snapshot.days().getFirst().items().getFirst().startTime())
        .isEqualTo(LocalTime.of(9, 0));
  }

  @Test
  void rejectsUnapprovedOrMissingCoverHostFromThePublicSnapshot() {
    Trip trip = trip(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2));
    trip.setCoverImageUrl("http://private-host.example/cover.jpg");
    ItineraryDay day = day(1, LocalDate.of(2026, 10, 1));
    stub(trip, day, List.of());

    assertThatThrownBy(() -> service.getPublicationSnapshot(userId, tripId))
        .hasMessageContaining("approved HTTPS media host");

    trip.setCoverImageUrl("https:///missing-host/cover.jpg");
    assertThatThrownBy(() -> service.getPublicationSnapshot(userId, tripId))
        .hasMessageContaining("approved HTTPS media host");

    trip.setCoverImageUrl("https://RES.CLOUDINARY.COM/demo/cover.jpg");
    var snapshot = service.getPublicationSnapshot(userId, tripId).snapshot();
    assertThat(snapshot.summary().coverImageUrl())
        .isEqualTo("https://RES.CLOUDINARY.COM/demo/cover.jpg");
  }

  @Test
  void autoResolvesApprovedPlacePhotoAsCoverWhenTripHasNoExplicitCover() {
    Trip trip = trip(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2));
    ItineraryDay day = day(1, LocalDate.of(2026, 10, 1));
    ItineraryItem meal = item("Quán Ăn", ItineraryItemType.MEAL, 1000);
    meal.setDayId(day.getId());
    meal.setPlaceRef("place-meal");
    ItineraryItem landmark = item("Ngũ Hành Sơn", ItineraryItemType.PLACE, 2000);
    landmark.setDayId(day.getId());
    landmark.setPlaceRef("place-nhs");
    stub(trip, day, List.of(meal, landmark));
    when(placeClient.fetchPlacePhotoUrls(List.of("place-nhs", "place-meal")))
        .thenReturn(
            java.util.Map.of(
                "place-nhs", "https://res.cloudinary.com/demo/nhs.jpg",
                "place-meal", "https://res.cloudinary.com/demo/meal.jpg"));

    var snapshot = service.getPublicationSnapshot(userId, tripId).snapshot();

    assertThat(snapshot.summary().coverImageUrl())
        .isEqualTo("https://res.cloudinary.com/demo/nhs.jpg");
  }

  private void stub(Trip trip, ItineraryDay day, List<ItineraryItem> dayItems) {
    for (ItineraryItem item : dayItems) {
      item.setDayId(day.getId());
    }
    when(trips.findByIdAndOwnerUserIdAndArchivedAtIsNull(tripId, userId))
        .thenReturn(Optional.of(trip));
    when(days.findByTripIdOrderByDayNumberAsc(tripId)).thenReturn(List.of(day));
    when(items.findByTripIdInOrderByTripIdAscSortOrderAsc(List.of(tripId))).thenReturn(dayItems);
  }

  private Trip trip(LocalDate start, LocalDate end) {
    return Trip.builder()
        .id(tripId)
        .ownerUserId(userId)
        .name("Da Nang")
        .destinationName("Da Nang")
        .startDate(start)
        .endDate(end)
        .status(TripStatus.CONFIRMED)
        .publicationRevision(7L)
        .build();
  }

  private ItineraryDay day(int number, LocalDate date) {
    return ItineraryDay.builder()
        .id(UUID.randomUUID())
        .tripId(tripId)
        .dayNumber(number)
        .dayDate(date)
        .build();
  }

  private ItineraryItem item(String title, ItineraryItemType type, int sortOrder) {
    return ItineraryItem.builder()
        .id(UUID.randomUUID())
        .tripId(tripId)
        .dayId(UUID.randomUUID())
        .title(title)
        .type(type)
        .sortOrder(sortOrder)
        .build();
  }
}
