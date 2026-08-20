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
        TripResponse trip = tripService.createTrip(USER_ID, createTripRequest("Da Nang", LocalDate.of(2026, 8, 20), LocalDate.of(2026, 8, 22)));

        ItineraryResponse itinerary = tripService.getItinerary(USER_ID, trip.id());

        assertThat(itinerary.days())
                .extracting(ItineraryDayResponse::dayNumber)
                .containsExactly(1, 2, 3);
        assertThat(itinerary.days())
                .extracting(ItineraryDayResponse::date)
                .containsExactly(LocalDate.of(2026, 8, 20), LocalDate.of(2026, 8, 21), LocalDate.of(2026, 8, 22));
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
    void createTripRejectsEndDateThatIsNotAfterStartDate() {
        assertThatThrownBy(() -> tripService.createTrip(
                USER_ID,
                createTripRequest("Same Day", LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 1))
        ))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("after startDate");
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
    void reorderAcceptsStaleDayVersionWhenItemIdsMatchCurrentDay() {
        TripResponse trip = tripService.createTrip(USER_ID, createTripRequest("Da Nang", LocalDate.of(2026, 10, 4), LocalDate.of(2026, 10, 5)));
        ItineraryDayResponse day = tripService.getItinerary(USER_ID, trip.id()).days().getFirst();
        ItineraryItemResponse first = tripService.createItem(USER_ID, trip.id(), day.id(), createItemRequest("Breakfast"));
        ItineraryItemResponse second = tripService.createItem(USER_ID, trip.id(), day.id(), createItemRequest("Museum"));

        ItineraryDayResponse reordered = tripService.reorderItems(
                USER_ID,
                trip.id(),
                day.id(),
                new ReorderItemsRequest(List.of(second.id(), first.id()), 0L)
        );

        assertThat(reordered.items())
                .extracting(ItineraryItemResponse::id)
                .containsExactly(second.id(), first.id());
    }

    @Test
    void reorderReassignsTimeSlotsFromEarliestToLatest() {
        TripResponse trip = tripService.createTrip(USER_ID, createTripRequest("Da Nang", LocalDate.of(2026, 10, 6), LocalDate.of(2026, 10, 7)));
        ItineraryDayResponse day = tripService.getItinerary(USER_ID, trip.id()).days().getFirst();
        ItineraryItemResponse lunch = tripService.createItem(
                USER_ID,
                trip.id(),
                day.id(),
                createItemRequest("Moc Quan Seafood", LocalTime.of(12, 0), LocalTime.of(13, 30))
        );
        ItineraryItemResponse dinner = tripService.createItem(
                USER_ID,
                trip.id(),
                day.id(),
                createItemRequest("Van May", LocalTime.of(18, 0), LocalTime.of(19, 15))
        );

        ItineraryDayResponse reordered = tripService.reorderItems(
                USER_ID,
                trip.id(),
                day.id(),
                new ReorderItemsRequest(List.of(dinner.id(), lunch.id()), 0L)
        );

        assertThat(reordered.items())
                .extracting(ItineraryItemResponse::id)
                .containsExactly(dinner.id(), lunch.id());
        assertThat(reordered.items())
                .extracting(ItineraryItemResponse::startTime)
                .containsExactly(LocalTime.of(12, 0), LocalTime.of(18, 0));
        assertThat(reordered.items())
                .extracting(ItineraryItemResponse::endTime)
                .containsExactly(LocalTime.of(13, 30), LocalTime.of(19, 15));
    }

    @Test
    void updateItemAcceptsStaleVersionAfterManualReorder() {
        TripResponse trip = tripService.createTrip(USER_ID, createTripRequest("Da Nang", LocalDate.of(2026, 10, 8), LocalDate.of(2026, 10, 9)));
        ItineraryDayResponse day = tripService.getItinerary(USER_ID, trip.id()).days().getFirst();
        ItineraryItemResponse first = tripService.createItem(USER_ID, trip.id(), day.id(), createItemRequest("Breakfast"));
        ItineraryItemResponse second = tripService.createItem(USER_ID, trip.id(), day.id(), createItemRequest("Museum"));
        tripService.reorderItems(USER_ID, trip.id(), day.id(), new ReorderItemsRequest(List.of(second.id(), first.id()), 0L));

        ItineraryItemResponse updated = tripService.updateItem(
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
                        0L
                )
        );

        assertThat(updated.title()).isEqualTo("Updated breakfast");
        assertThat(updated.status()).isEqualTo(ItineraryItemStatus.DONE);
        assertThat(updated.startTime()).isEqualTo(LocalTime.of(8, 30));
    }

    @Test
    void deleteItemIsIdempotentWhenItemWasAlreadyRemoved() {
        TripResponse trip = tripService.createTrip(USER_ID, createTripRequest("Da Nang", LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 11)));
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
        return new CreateItineraryItemRequest(
                null,
                ItineraryItemType.NOTE,
                title,
                startTime,
                endTime,
                60,
                null
        );
    }
}
