package fu.tripsense.tripservice.service;

import fu.tripsense.tripservice.dto.request.CreateItineraryItemRequest;
import fu.tripsense.tripservice.dto.request.CreateTripRequest;
import fu.tripsense.tripservice.dto.request.ReorderItemsRequest;
import fu.tripsense.tripservice.dto.request.UpdateItineraryItemRequest;
import fu.tripsense.tripservice.dto.request.UpdateTripRequest;
import fu.tripsense.tripservice.dto.response.ItineraryDayResponse;
import fu.tripsense.tripservice.dto.response.ItineraryItemResponse;
import fu.tripsense.tripservice.dto.response.ItineraryResponse;
import fu.tripsense.tripservice.dto.response.TripResponse;
import fu.tripsense.tripservice.enums.DateChangePolicy;
import fu.tripsense.tripservice.enums.ItineraryItemStatus;
import fu.tripsense.tripservice.enums.ItineraryItemType;
import fu.tripsense.tripservice.exception.ConflictException;
import fu.tripsense.tripservice.exception.ValidationException;
import fu.tripsense.tripservice.support.RealInfrastructureTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class TripServiceTest extends RealInfrastructureTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Autowired
    private TripService tripService;

    @Test
    void createTripGeneratesItineraryDays() {
        TripResponse trip = tripService.createTrip(USER_ID, createTripRequest("Da Nang", LocalDate.of(2026, 8, 24), LocalDate.of(2026, 8, 26)));

        ItineraryResponse itinerary = tripService.getItinerary(USER_ID, trip.id());

        assertThat(itinerary.days())
                .extracting(ItineraryDayResponse::dayNumber)
                .containsExactly(1, 2, 3);
        assertThat(itinerary.days())
                .extracting(ItineraryDayResponse::date)
                .containsExactly(LocalDate.of(2026, 8, 24), LocalDate.of(2026, 8, 25), LocalDate.of(2026, 8, 26));
    }

    @Test
    void dateShrinkIsBlockedWhenItemsWouldFallOutsideNewRange() {
        TripResponse trip = tripService.createTrip(USER_ID, createTripRequest("Hoi An", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 3)));
        ItineraryDayResponse dayThree = tripService.getItinerary(USER_ID, trip.id()).days().get(2);
        tripService.createItem(USER_ID, trip.id(), dayThree.id(), createItemRequest("Coffee stop"));

        UpdateTripRequest shrinkRequest = new UpdateTripRequest(
                null,
                null,
                null,
                LocalDate.of(2026, 9, 1),
                LocalDate.of(2026, 9, 2),
                DateChangePolicy.BLOCK_IF_ITEMS_OUTSIDE_RANGE,
                null,
                null,
                null,
                null,
                null,
                null
        );

        assertThatThrownBy(() -> tripService.updateTrip(USER_ID, trip.id(), shrinkRequest))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("outside the trip range");
    }

    @Test
    void updateTripStoresCoverImageUrl() {
        TripResponse trip = tripService.createTrip(USER_ID, createTripRequest("Da Nang", LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 2)));
        String coverImageUrl = "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&auto=format&fit=crop&q=80";

        TripResponse updated = tripService.updateTrip(USER_ID, trip.id(), new UpdateTripRequest(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                coverImageUrl
        ));

        assertThat(updated.coverImageUrl()).isEqualTo(coverImageUrl);
    }

    @Test
    void createTripRejectsPastStartDate() {
        assertThatThrownBy(() -> tripService.createTrip(
                USER_ID,
                createTripRequest("Past", LocalDate.of(2026, 8, 18), LocalDate.of(2026, 8, 20))
        ))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("past");
    }

    @Test
    void createTripAllowsSameDayTrip() {
        TripResponse trip = tripService.createTrip(
                USER_ID,
                createTripRequest("Same Day", LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 1))
        );

        ItineraryResponse itinerary = tripService.getItinerary(USER_ID, trip.id());

        assertThat(trip.startDate()).isEqualTo(trip.endDate());
        assertThat(itinerary.days()).hasSize(1);
        assertThat(itinerary.days().getFirst().date()).isEqualTo(LocalDate.of(2026, 10, 1));
    }

    @Test
    void reorderRejectsPayloadThatDoesNotContainEveryItemInTheDay() {
        TripResponse trip = tripService.createTrip(USER_ID, createTripRequest("Hue", LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2)));
        ItineraryDayResponse day = tripService.getItinerary(USER_ID, trip.id()).days().getFirst();
        ItineraryItemResponse first = tripService.createItem(USER_ID, trip.id(), day.id(), createItemRequest("Breakfast"));
        tripService.createItem(USER_ID, trip.id(), day.id(), createItemRequest("Museum"));
        ItineraryDayResponse currentDay = tripService.getItineraryDay(USER_ID, trip.id(), day.id());

        ReorderItemsRequest badRequest = new ReorderItemsRequest(List.of(first.id()), currentDay.version());

        assertThatThrownBy(() -> tripService.reorderItems(USER_ID, trip.id(), day.id(), badRequest))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("exactly the current day item IDs");
    }

    @Test
    void reorderRejectsStaleDayVersion() {
        TripResponse trip = tripService.createTrip(USER_ID, createTripRequest("Da Nang", LocalDate.of(2026, 10, 4), LocalDate.of(2026, 10, 5)));
        ItineraryDayResponse day = tripService.getItinerary(USER_ID, trip.id()).days().getFirst();
        ItineraryItemResponse first = tripService.createItem(USER_ID, trip.id(), day.id(), createItemRequest("Breakfast"));
        ItineraryItemResponse second = tripService.createItem(USER_ID, trip.id(), day.id(), createItemRequest("Museum"));
        ItineraryDayResponse currentDay = tripService.getItineraryDay(USER_ID, trip.id(), day.id());

        assertThatThrownBy(() -> tripService.reorderItems(
                USER_ID,
                trip.id(),
                day.id(),
                new ReorderItemsRequest(List.of(second.id(), first.id()), currentDay.version() + 1)
        ))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("modified concurrently");
    }

    @Test
    void reorderPreservesDurationAndChainsMovedItemsAfterPreviousEndTime() {
        TripResponse trip = tripService.createTrip(USER_ID, createTripRequest("Da Nang", LocalDate.of(2026, 10, 6), LocalDate.of(2026, 10, 7)));
        ItineraryDayResponse day = tripService.getItinerary(USER_ID, trip.id()).days().getFirst();
        ItineraryItemResponse pointA = tripService.createItem(
                USER_ID,
                trip.id(),
                day.id(),
                createItemRequest("Point A", LocalTime.of(15, 0), LocalTime.of(17, 0))
        );
        ItineraryItemResponse pointB = tripService.createItem(
                USER_ID,
                trip.id(),
                day.id(),
                createItemRequest("Point B", LocalTime.of(17, 0), LocalTime.of(19, 0))
        );
        ItineraryDayResponse currentDay = tripService.getItineraryDay(USER_ID, trip.id(), day.id());

        ItineraryDayResponse aAfterB = tripService.reorderItems(
                USER_ID,
                trip.id(),
                day.id(),
                new ReorderItemsRequest(List.of(pointB.id(), pointA.id()), currentDay.version())
        );

        assertThat(aAfterB.items())
                .extracting(ItineraryItemResponse::id)
                .containsExactly(pointB.id(), pointA.id());
        assertThat(aAfterB.items())
                .extracting(ItineraryItemResponse::startTime)
                .containsExactly(LocalTime.of(17, 0), LocalTime.of(19, 0));
        assertThat(aAfterB.items())
                .extracting(ItineraryItemResponse::endTime)
                .containsExactly(LocalTime.of(19, 0), LocalTime.of(21, 0));
        assertThat(aAfterB.items())
                .extracting(ItineraryItemResponse::durationMinutes)
                .containsExactly(120, 120);

        ItineraryDayResponse refreshedDay = tripService.getItineraryDay(USER_ID, trip.id(), day.id());
        ItineraryDayResponse bAfterA = tripService.reorderItems(
                USER_ID,
                trip.id(),
                day.id(),
                new ReorderItemsRequest(List.of(pointA.id(), pointB.id()), refreshedDay.version())
        );

        assertThat(bAfterA.items())
                .extracting(ItineraryItemResponse::id)
                .containsExactly(pointA.id(), pointB.id());
        assertThat(bAfterA.items())
                .extracting(ItineraryItemResponse::startTime)
                .containsExactly(LocalTime.of(19, 0), LocalTime.of(21, 0));
        assertThat(bAfterA.items())
                .extracting(ItineraryItemResponse::endTime)
                .containsExactly(LocalTime.of(21, 0), LocalTime.of(23, 0));
        assertThat(bAfterA.items())
                .extracting(ItineraryItemResponse::durationMinutes)
                .containsExactly(120, 120);
    }

    @Test
    void reorderMovedItemStartsAtPreviousItemsEndAndKeepsItsOwnDuration() {
        TripResponse trip = tripService.createTrip(USER_ID, createTripRequest("Da Nang", LocalDate.of(2026, 10, 8), LocalDate.of(2026, 10, 9)));
        ItineraryDayResponse day = tripService.getItinerary(USER_ID, trip.id()).days().getFirst();
        ItineraryItemResponse madameLan = tripService.createItem(
                USER_ID,
                trip.id(),
                day.id(),
                createItemRequest("Nha hang Madame Lan", LocalTime.of(9, 0), LocalTime.of(10, 30))
        );
        ItineraryItemResponse mocQuan = tripService.createItem(
                USER_ID,
                trip.id(),
                day.id(),
                createItemRequest("Moc Quan Seafood", LocalTime.of(10, 30), LocalTime.of(15, 0))
        );
        ItineraryDayResponse currentDay = tripService.getItineraryDay(USER_ID, trip.id(), day.id());

        ItineraryDayResponse reordered = tripService.reorderItems(
                USER_ID,
                trip.id(),
                day.id(),
                new ReorderItemsRequest(List.of(mocQuan.id(), madameLan.id()), currentDay.version())
        );

        assertThat(reordered.items())
                .extracting(ItineraryItemResponse::id)
                .containsExactly(mocQuan.id(), madameLan.id());
        assertThat(reordered.items())
                .extracting(ItineraryItemResponse::startTime)
                .containsExactly(LocalTime.of(10, 30), LocalTime.of(15, 0));
        assertThat(reordered.items())
                .extracting(ItineraryItemResponse::endTime)
                .containsExactly(LocalTime.of(15, 0), LocalTime.of(16, 30));
        assertThat(reordered.items())
                .extracting(ItineraryItemResponse::durationMinutes)
                .containsExactly(270, 90);
    }

    @Test
    void reorderChainsItemsWhenEndTimeIsImplicit() {
        TripResponse trip = tripService.createTrip(USER_ID, createTripRequest("Da Nang", LocalDate.of(2026, 10, 12), LocalDate.of(2026, 10, 13)));
        ItineraryDayResponse day = tripService.getItinerary(USER_ID, trip.id()).days().getFirst();
        ItineraryItemResponse item1 = tripService.createItem(
                USER_ID,
                trip.id(),
                day.id(),
                new CreateItineraryItemRequest(null, ItineraryItemType.MEAL, "Item 1", LocalTime.of(16, 30), null, 60, null)
        );
        ItineraryItemResponse item2 = tripService.createItem(
                USER_ID,
                trip.id(),
                day.id(),
                new CreateItineraryItemRequest(null, ItineraryItemType.MEAL, "Item 2", LocalTime.of(21, 0), null, 90, null)
        );
        ItineraryDayResponse currentDay = tripService.getItineraryDay(USER_ID, trip.id(), day.id());

        ItineraryDayResponse reordered = tripService.reorderItems(
                USER_ID,
                trip.id(),
                day.id(),
                new ReorderItemsRequest(List.of(item2.id(), item1.id()), currentDay.version())
        );

        assertThat(reordered.items())
                .extracting(ItineraryItemResponse::id)
                .containsExactly(item2.id(), item1.id());
        assertThat(reordered.items())
                .extracting(ItineraryItemResponse::startTime)
                .containsExactly(LocalTime.of(21, 0), LocalTime.of(22, 30));
        assertThat(reordered.items())
                .extracting(ItineraryItemResponse::endTime)
                .containsExactly(LocalTime.of(22, 30), LocalTime.of(23, 30));
    }

    @Test
    void updateItemRejectsStaleVersion() {
        TripResponse trip = tripService.createTrip(USER_ID, createTripRequest("Da Nang", LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 11)));
        ItineraryDayResponse day = tripService.getItinerary(USER_ID, trip.id()).days().getFirst();
        ItineraryItemResponse first = tripService.createItem(USER_ID, trip.id(), day.id(), createItemRequest("Breakfast"));

        assertThatThrownBy(() -> tripService.updateItem(
                USER_ID,
                trip.id(),
                first.id(),
                new UpdateItineraryItemRequest(
                        null,
                        ItineraryItemType.MEAL,
                        "Updated breakfast",
                        LocalTime.of(8, 30),
                        LocalTime.of(9, 30),
                        60,
                        ItineraryItemStatus.DONE,
                        "Updated manually",
                        first.version() + 1
                )
        ))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("modified concurrently");
    }

    @Test
    void deleteItemIsIdempotentWhenItemWasAlreadyRemoved() {
        TripResponse trip = tripService.createTrip(USER_ID, createTripRequest("Da Nang", LocalDate.of(2026, 10, 12), LocalDate.of(2026, 10, 13)));
        ItineraryDayResponse day = tripService.getItinerary(USER_ID, trip.id()).days().getFirst();
        ItineraryItemResponse item = tripService.createItem(USER_ID, trip.id(), day.id(), createItemRequest("Breakfast"));

        tripService.deleteItem(USER_ID, trip.id(), item.id());
        tripService.deleteItem(USER_ID, trip.id(), item.id());

        ItineraryDayResponse refreshedDay = tripService.getItineraryDay(USER_ID, trip.id(), day.id());
        assertThat(refreshedDay.items()).isEmpty();
    }

    private CreateTripRequest createTripRequest(String destination, LocalDate startDate, LocalDate endDate) {
        return new CreateTripRequest(
                destination + " Trip",
                destination,
                null,
                startDate,
                endDate,
                2,
                null,
                null,
                null,
                null
        );
    }

    private CreateItineraryItemRequest createItemRequest(String title) {
        return createItemRequest(title, LocalTime.of(9, 0), LocalTime.of(10, 0));
    }

    private CreateItineraryItemRequest createItemRequest(String title, LocalTime startTime, LocalTime endTime) {
        Integer durationMinutes = startTime != null && endTime != null && startTime.isBefore(endTime)
                ? Math.toIntExact(java.time.temporal.ChronoUnit.MINUTES.between(startTime, endTime))
                : null;
        return new CreateItineraryItemRequest(
                null,
                ItineraryItemType.NOTE,
                title,
                startTime,
                endTime,
                durationMinutes,
                null
        );
    }
}
