package fu.tripsense.socialservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

import fu.tripsense.socialservice.client.PlaceClient;
import fu.tripsense.socialservice.client.UserPublicProfileClient;
import fu.tripsense.socialservice.entity.PlaceReview;
import fu.tripsense.socialservice.repository.PlaceReviewRepository;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

class PlaceReviewServiceTest {
  @Mock private PlaceReviewRepository reviews;
  @Mock private UserPublicProfileClient profiles;
  @Mock private PlaceClient places;

  private PlaceReviewService service;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    service = new PlaceReviewService(reviews, profiles, places);
  }

  @Test
  void returnsCurrentUsersReviewEvenWhenItIsOutsideRequestedPage() {
    UUID currentUserId = UUID.randomUUID();
    PlaceReview pageReview = review(UUID.randomUUID(), UUID.randomUUID(), "place", 5);
    PlaceReview ownReview = review(UUID.randomUUID(), currentUserId, "place", 4);
    when(reviews.findByPlaceRefAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
            eq("place"), eq("PUBLISHED"), any(Pageable.class)))
        .thenReturn(new PageImpl<>(java.util.List.of(pageReview)));
    when(reviews.findByAuthorUserIdAndPlaceRefAndDeletedAtIsNull(currentUserId, "place"))
        .thenReturn(Optional.of(ownReview));
    when(reviews.summarize("place")).thenReturn(new Object[] {2L, 4.5d});
    when(profiles.fetchPublicProfiles(anyList())).thenReturn(Map.of());

    var response = service.list("place", currentUserId, 0, 1);

    assertThat(response.items()).extracting(item -> item.id()).containsExactly(pageReview.getId());
    assertThat(response.currentUserReview()).isNotNull();
    assertThat(response.currentUserReview().id()).isEqualTo(ownReview.getId());
    assertThat(response.currentUserReview().ownedByCurrentUser()).isTrue();
  }

  private PlaceReview review(UUID id, UUID authorId, String placeRef, int rating) {
    Instant now = Instant.parse("2026-09-30T12:00:00Z");
    return PlaceReview.builder()
        .id(id)
        .authorUserId(authorId)
        .placeRef(placeRef)
        .rating((short) rating)
        .content("A sufficiently detailed review")
        .status("PUBLISHED")
        .version(0L)
        .createdAt(now)
        .updatedAt(now)
        .build();
  }
}
