package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import fu.tripsense.placeservice.domain.model.UserPlaceCollection;
import fu.tripsense.placeservice.domain.model.UserSavedPlace;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.domain.repository.UserPlaceCollectionRepository;
import fu.tripsense.placeservice.domain.repository.UserSavedPlaceRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

class UserSavedPlaceServiceTest {
  @Mock private UserPlaceCollectionRepository collections;
  @Mock private UserSavedPlaceRepository savedPlaces;
  @Mock private PlaceRepository places;
  @Mock private PlaceDetailsService placeDetailsService;

  private UserSavedPlaceService service;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    service = new UserSavedPlaceService(collections, savedPlaces, places, placeDetailsService);
  }

  @Test
  void savedStatusBatchUsesOneMembershipQuery() {
    UUID ownerId = UUID.randomUUID();
    UUID collectionId = UUID.randomUUID();
    when(savedPlaces.findByOwnerUserIdAndPlaceRefIn(ownerId, List.of("one", "two")))
        .thenReturn(
            List.of(
                UserSavedPlace.builder()
                    .ownerUserId(ownerId)
                    .collectionId(collectionId)
                    .placeRef("one")
                    .build()));

    var response = service.statuses(ownerId, List.of("one", "two", "one"));

    assertThat(response.items()).hasSize(2);
    assertThat(response.items().getFirst().saved()).isTrue();
    assertThat(response.items().get(1).saved()).isFalse();
    verify(savedPlaces).findByOwnerUserIdAndPlaceRefIn(ownerId, List.of("one", "two"));
    verifyNoMoreInteractions(savedPlaces);
  }

  @Test
  void deleteCollectionCanRetryOrphanCleanupWithoutBypassingOwnership() {
    UUID ownerId = UUID.randomUUID();
    UUID collectionId = UUID.randomUUID();
    when(collections.findByIdAndOwnerUserId(collectionId, ownerId)).thenReturn(Optional.empty());
    when(savedPlaces.existsByOwnerUserIdAndCollectionId(ownerId, collectionId)).thenReturn(true);

    service.deleteCollection(ownerId, collectionId);

    verify(collections, never()).delete(any(UserPlaceCollection.class));
    verify(savedPlaces).deleteByOwnerUserIdAndCollectionId(ownerId, collectionId);
  }
}
