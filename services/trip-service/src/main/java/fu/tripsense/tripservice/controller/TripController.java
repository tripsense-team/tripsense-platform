package fu.tripsense.tripservice.controller;

import fu.tripsense.tripservice.dto.request.*;
import fu.tripsense.tripservice.dto.response.*;
import fu.tripsense.tripservice.enums.TripStatus;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import fu.tripsense.tripservice.service.TripService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/trips")
@RequiredArgsConstructor
public class TripController {

    private final TripService tripService;
    private final CurrentUserProvider currentUserProvider;

    @PostMapping
    public ResponseEntity<ApiResponse<TripResponse>> createTrip(@Valid @RequestBody CreateTripRequest request) {
        TripResponse response = tripService.createTrip(currentUserProvider.userId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Trip created", response));
    }

    @GetMapping
    public ApiResponse<TripListResponse> listTrips(
            @RequestParam(required = false) TripStatus status,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.success(tripService.listTrips(currentUserProvider.userId(), status, from, to, page, size));
    }

    @GetMapping("/{tripId}")
    public ApiResponse<TripResponse> getTrip(@PathVariable UUID tripId) {
        return ApiResponse.success(tripService.getTrip(currentUserProvider.userId(), tripId));
    }

    @PatchMapping("/{tripId}")
    public ApiResponse<TripResponse> updateTrip(@PathVariable UUID tripId, @Valid @RequestBody UpdateTripRequest request) {
        return ApiResponse.success("Trip updated", tripService.updateTrip(currentUserProvider.userId(), tripId, request));
    }

    @DeleteMapping("/{tripId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void archiveTrip(@PathVariable UUID tripId) {
        tripService.archiveTrip(currentUserProvider.userId(), tripId);
    }

    @GetMapping("/{tripId}/itinerary")
    public ApiResponse<ItineraryResponse> getItinerary(@PathVariable UUID tripId) {
        return ApiResponse.success(tripService.getItinerary(currentUserProvider.userId(), tripId));
    }

    @GetMapping("/{tripId}/itinerary/days/{dayId}")
    public ApiResponse<ItineraryDayResponse> getItineraryDay(@PathVariable UUID tripId, @PathVariable UUID dayId) {
        return ApiResponse.success(tripService.getItineraryDay(currentUserProvider.userId(), tripId, dayId));
    }

    @PostMapping("/{tripId}/itinerary/days/{dayId}/items")
    public ResponseEntity<ApiResponse<ItineraryItemResponse>> createItem(
            @PathVariable UUID tripId,
            @PathVariable UUID dayId,
            @Valid @RequestBody CreateItineraryItemRequest request
    ) {
        ItineraryItemResponse response = tripService.createItem(currentUserProvider.userId(), tripId, dayId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Itinerary item created", response));
    }

    @PatchMapping("/{tripId}/itinerary/items/{itemId}")
    public ApiResponse<ItineraryItemResponse> updateItem(
            @PathVariable UUID tripId,
            @PathVariable UUID itemId,
            @Valid @RequestBody UpdateItineraryItemRequest request
    ) {
        return ApiResponse.success("Itinerary item updated", tripService.updateItem(currentUserProvider.userId(), tripId, itemId, request));
    }

    @DeleteMapping("/{tripId}/itinerary/items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteItem(@PathVariable UUID tripId, @PathVariable UUID itemId) {
        tripService.deleteItem(currentUserProvider.userId(), tripId, itemId);
    }

    @PutMapping("/{tripId}/itinerary/days/{dayId}/items/reorder")
    public ApiResponse<ItineraryDayResponse> reorderItems(
            @PathVariable UUID tripId,
            @PathVariable UUID dayId,
            @Valid @RequestBody ReorderItemsRequest request
    ) {
        return ApiResponse.success("Itinerary items reordered", tripService.reorderItems(currentUserProvider.userId(), tripId, dayId, request));
    }
}
