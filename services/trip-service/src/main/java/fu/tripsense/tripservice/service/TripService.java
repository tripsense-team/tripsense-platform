package fu.tripsense.tripservice.service;

import fu.tripsense.tripservice.dto.request.CreateItineraryItemRequest;
import fu.tripsense.tripservice.dto.request.CreateTripRequest;
import fu.tripsense.tripservice.dto.request.ReorderItemsRequest;
import fu.tripsense.tripservice.dto.request.UpdateItineraryItemRequest;
import fu.tripsense.tripservice.dto.request.UpdateTripRequest;
import fu.tripsense.tripservice.dto.response.ItineraryDayResponse;
import fu.tripsense.tripservice.dto.response.ItineraryItemResponse;
import fu.tripsense.tripservice.dto.response.ItineraryResponse;
import fu.tripsense.tripservice.dto.response.TripListResponse;
import fu.tripsense.tripservice.dto.response.TripResponse;
import fu.tripsense.tripservice.enums.TripStatus;

import java.time.LocalDate;
import java.util.UUID;

public interface TripService {

    TripResponse createTrip(UUID userId, CreateTripRequest request);

    TripListResponse listTrips(UUID userId, TripStatus status, LocalDate from, LocalDate to, int page, int size);

    TripResponse getTrip(UUID userId, UUID tripId);

    TripResponse updateTrip(UUID userId, UUID tripId, UpdateTripRequest request);

    void archiveTrip(UUID userId, UUID tripId);

    ItineraryResponse getItinerary(UUID userId, UUID tripId);

    ItineraryDayResponse getItineraryDay(UUID userId, UUID tripId, UUID dayId);

    ItineraryItemResponse createItem(UUID userId, UUID tripId, UUID dayId, CreateItineraryItemRequest request);

    ItineraryItemResponse updateItem(UUID userId, UUID tripId, UUID itemId, UpdateItineraryItemRequest request);

    void deleteItem(UUID userId, UUID tripId, UUID itemId);

    ItineraryDayResponse reorderItems(UUID userId, UUID tripId, UUID dayId, ReorderItemsRequest request);
}
