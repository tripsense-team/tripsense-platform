package fu.tripsense.socialservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import fu.tripsense.socialservice.client.PublicProfileClientResponse;
import fu.tripsense.socialservice.client.UserPublicProfileClient;
import fu.tripsense.socialservice.dto.response.SuggestedCreatorResponse;
import fu.tripsense.socialservice.entity.SocialUserFollow;
import fu.tripsense.socialservice.entity.SocialUserFollowId;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.SocialPostRepository;
import fu.tripsense.socialservice.repository.SocialTripShareRepository;
import fu.tripsense.socialservice.repository.SocialUserFollowRepository;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import fu.tripsense.socialservice.service.impl.SocialCreatorServiceImpl;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;

class SocialCreatorServiceImplTest {

  private SocialPostRepository postRepository;
  private SocialUserFollowRepository followRepository;
  private SocialTripShareRepository tripShareRepository;
  private UserPublicProfileClient publicProfileClient;
  private SocialCreatorServiceImpl creatorService;

  private final UUID viewerId = UUID.randomUUID();
  private final AuthenticatedUser viewer =
      new AuthenticatedUser(viewerId, "viewer@tripsense.app", "ROLE_USER");

  @BeforeEach
  void setUp() {
    postRepository = mock(SocialPostRepository.class);
    followRepository = mock(SocialUserFollowRepository.class);
    tripShareRepository = mock(SocialTripShareRepository.class);
    publicProfileClient = mock(UserPublicProfileClient.class);

    creatorService =
        new SocialCreatorServiceImpl(
            postRepository, followRepository, tripShareRepository, publicProfileClient);
  }

  @Test
  void getSuggestedCreators_invalidLimit_throwsBadRequest() {
    assertThatThrownBy(() -> creatorService.getSuggestedCreators(viewer, 0))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Limit must be between 1 and 20");

    assertThatThrownBy(() -> creatorService.getSuggestedCreators(viewer, 21))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Limit must be between 1 and 20");
  }

  @Test
  void getSuggestedCreators_emptyPosts_returnsEmptyList() {
    when(postRepository.findActiveCreatorSummaries(eq(viewerId), any(PageRequest.class)))
        .thenReturn(Collections.emptyList());

    List<SuggestedCreatorResponse> result = creatorService.getSuggestedCreators(viewer, 4);

    assertThat(result).isEmpty();
    verifyNoInteractions(publicProfileClient);
    verifyNoInteractions(followRepository);
  }

  @Test
  void getSuggestedCreators_authenticatedViewer_prioritizesUnfollowedCreatorsAndEnrichesProfile() {
    UUID creator1 = UUID.randomUUID();
    UUID creator2 = UUID.randomUUID();

    // creator1: 5 followers, unfollowed by viewer
    // creator2: 100 followers, followed by viewer
    List<Object[]> summaries =
        List.of(
            new Object[] {creator1, "Author One", 3L},
            new Object[] {creator2, "Author Two", 10L});

    when(postRepository.findActiveCreatorSummaries(eq(viewerId), any(PageRequest.class)))
        .thenReturn(summaries);

    when(publicProfileClient.fetchPublicProfiles(List.of(creator1, creator2)))
        .thenReturn(
            Map.of(
                creator1,
                new PublicProfileClientResponse(creator1, "Alice Explorer", "https://img.com/alice.jpg")));

    // Viewer follows creator2
    SocialUserFollow follow =
        SocialUserFollow.builder()
            .id(new SocialUserFollowId(viewerId, creator2))
            .createdAt(Instant.now())
            .build();
    when(followRepository.findByIdFollowerUserIdAndIdFollowedUserIdIn(
            eq(viewerId), eq(List.of(creator1, creator2))))
        .thenReturn(List.of(follow));

    when(followRepository.countByIdFollowedUserId(creator1)).thenReturn(5L);
    when(followRepository.countByIdFollowedUserId(creator2)).thenReturn(100L);

    List<SuggestedCreatorResponse> result = creatorService.getSuggestedCreators(viewer, 4);

    assertThat(result).hasSize(2);

    // creator1 should come first because isFollowing is false
    SuggestedCreatorResponse first = result.get(0);
    assertThat(first.id()).isEqualTo(creator1);
    assertThat(first.name()).isEqualTo("Alice Explorer");
    assertThat(first.avatar()).isEqualTo("https://img.com/alice.jpg");
    assertThat(first.isFollowing()).isFalse();
    assertThat(first.followerCount()).isEqualTo(5L);
    assertThat(first.tripCount()).isEqualTo(3);
    assertThat(first.niche()).isNotBlank();
    assertThat(first.nicheKey()).isNotBlank();

    // creator2 should come second because isFollowing is true
    SuggestedCreatorResponse second = result.get(1);
    assertThat(second.id()).isEqualTo(creator2);
    assertThat(second.name()).isEqualTo("Author Two"); // fallback to author name
    assertThat(second.avatar()).isNotBlank(); // default avatar
    assertThat(second.isFollowing()).isTrue();
    assertThat(second.followerCount()).isEqualTo(100L);
    assertThat(second.tripCount()).isEqualTo(10);
  }

  @Test
  void getSuggestedCreators_anonymousViewer_sortsByFollowerCountDesc() {
    UUID creator1 = UUID.randomUUID();
    UUID creator2 = UUID.randomUUID();

    List<Object[]> summaries =
        List.of(
            new Object[] {creator1, "Creator 1", 2L},
            new Object[] {creator2, "Creator 2", 8L});

    when(postRepository.findActiveCreatorSummaries(isNull(), any(PageRequest.class)))
        .thenReturn(summaries);

    when(publicProfileClient.fetchPublicProfiles(List.of(creator1, creator2)))
        .thenReturn(Collections.emptyMap());

    when(followRepository.countByIdFollowedUserId(creator1)).thenReturn(10L);
    when(followRepository.countByIdFollowedUserId(creator2)).thenReturn(50L);

    List<SuggestedCreatorResponse> result = creatorService.getSuggestedCreators(null, 4);

    assertThat(result).hasSize(2);
    // Since both have isFollowing = false, creator2 (50 followers) comes before creator1 (10 followers)
    assertThat(result.get(0).id()).isEqualTo(creator2);
    assertThat(result.get(0).followerCount()).isEqualTo(50L);
    assertThat(result.get(0).isFollowing()).isFalse();

    assertThat(result.get(1).id()).isEqualTo(creator1);
    assertThat(result.get(1).followerCount()).isEqualTo(10L);
    assertThat(result.get(1).isFollowing()).isFalse();

    verify(followRepository, never())
        .findByIdFollowerUserIdAndIdFollowedUserIdIn(any(), any());
  }
}
