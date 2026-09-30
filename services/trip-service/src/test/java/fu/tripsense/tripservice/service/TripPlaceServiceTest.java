package fu.tripsense.tripservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import fu.tripsense.tripservice.client.PlaceClient;
import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.entity.TripPlace;
import fu.tripsense.tripservice.enums.TripStatus;
import fu.tripsense.tripservice.repository.TripPlaceRepository;
import fu.tripsense.tripservice.repository.TripRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

class TripPlaceServiceTest {
  @Mock private TripRepository trips;
  @Mock private TripPlaceRepository tripPlaces;
  @Mock private PlaceClient placeClient;

  private TripPlaceService service;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    service = new TripPlaceService(trips, tripPlaces, placeClient);
  }

  @Test
  void idempotentAddLocksTripBeforeCheckingExistingMembership() {
    UUID ownerId = UUID.randomUUID();
    UUID tripId = UUID.randomUUID();
    Trip trip = Trip.builder().id(tripId).ownerUserId(ownerId).status(TripStatus.DRAFT).build();
    TripPlace existing =
        TripPlace.builder()
            .id(UUID.randomUUID())
            .tripId(tripId)
            .placeRef("canonical-place")
            .placeNameSnapshot("Existing place")
            .addedByUserId(ownerId)
            .version(0L)
            .build();
    when(trips.findOwnedForUpdate(tripId, ownerId)).thenReturn(Optional.of(trip));
    when(tripPlaces.findByTripIdAndPlaceRef(tripId, "canonical-place"))
        .thenReturn(Optional.of(existing));

    var response = service.add(ownerId, tripId, "canonical-place");

    assertThat(response.id()).isEqualTo(existing.getId());
    InOrder calls = inOrder(trips, tripPlaces);
    calls.verify(trips).findOwnedForUpdate(tripId, ownerId);
    calls.verify(tripPlaces).findByTripIdAndPlaceRef(tripId, "canonical-place");
    verifyNoInteractions(placeClient);
    verify(tripPlaces, never()).saveAndFlush(any());
  }
}
