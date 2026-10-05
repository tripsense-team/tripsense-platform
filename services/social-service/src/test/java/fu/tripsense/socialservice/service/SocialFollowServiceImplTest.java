package fu.tripsense.socialservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import fu.tripsense.socialservice.dto.response.FollowResponse;
import fu.tripsense.socialservice.entity.SocialUserFollow;
import fu.tripsense.socialservice.entity.SocialUserFollowId;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.SocialUserFollowRepository;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import fu.tripsense.socialservice.service.impl.SocialFollowServiceImpl;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class SocialFollowServiceImplTest {

  private SocialUserFollowRepository followRepository;
  private SocialFollowService followService;

  private final UUID currentUserId = UUID.randomUUID();
  private final UUID targetUserId = UUID.randomUUID();
  private final AuthenticatedUser currentUser =
      new AuthenticatedUser(currentUserId, "test@tripsense.app", "ROLE_USER");

  @BeforeEach
  void setUp() {
    followRepository = mock(SocialUserFollowRepository.class);
    followService = new SocialFollowServiceImpl(followRepository);
  }

  @Test
  void followUser_successfully_saves_and_returns_follower_count() {
    SocialUserFollowId id = new SocialUserFollowId(currentUserId, targetUserId);
    when(followRepository.existsById(id)).thenReturn(false);
    when(followRepository.countByIdFollowedUserId(targetUserId)).thenReturn(42L);

    FollowResponse response = followService.followUser(currentUser, targetUserId);

    assertThat(response.following()).isTrue();
    assertThat(response.followerCount()).isEqualTo(42L);

    ArgumentCaptor<SocialUserFollow> captor = ArgumentCaptor.forClass(SocialUserFollow.class);
    verify(followRepository).save(captor.capture());
    assertThat(captor.getValue().getId()).isEqualTo(id);
  }

  @Test
  void followUser_is_idempotent_when_already_following() {
    SocialUserFollowId id = new SocialUserFollowId(currentUserId, targetUserId);
    when(followRepository.existsById(id)).thenReturn(true);
    when(followRepository.countByIdFollowedUserId(targetUserId)).thenReturn(10L);

    FollowResponse response = followService.followUser(currentUser, targetUserId);

    assertThat(response.following()).isTrue();
    assertThat(response.followerCount()).isEqualTo(10L);
    verify(followRepository, never()).save(any());
  }

  @Test
  void followUser_throws_exception_when_following_self() {
    assertThatThrownBy(() -> followService.followUser(currentUser, currentUserId))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("cannot follow yourself");
  }

  @Test
  void followUser_throws_exception_when_target_is_null() {
    assertThatThrownBy(() -> followService.followUser(currentUser, null))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("cannot be null");
  }

  @Test
  void unfollowUser_successfully_deletes_and_returns_updated_count() {
    SocialUserFollowId id = new SocialUserFollowId(currentUserId, targetUserId);
    when(followRepository.existsById(id)).thenReturn(true);
    when(followRepository.countByIdFollowedUserId(targetUserId)).thenReturn(41L);

    FollowResponse response = followService.unfollowUser(currentUser, targetUserId);

    assertThat(response.following()).isFalse();
    assertThat(response.followerCount()).isEqualTo(41L);
    verify(followRepository).deleteById(id);
  }

  @Test
  void unfollowUser_is_idempotent_when_not_following() {
    SocialUserFollowId id = new SocialUserFollowId(currentUserId, targetUserId);
    when(followRepository.existsById(id)).thenReturn(false);
    when(followRepository.countByIdFollowedUserId(targetUserId)).thenReturn(0L);

    FollowResponse response = followService.unfollowUser(currentUser, targetUserId);

    assertThat(response.following()).isFalse();
    assertThat(response.followerCount()).isEqualTo(0L);
    verify(followRepository, never()).deleteById(any());
  }

  @Test
  void unfollowUser_throws_exception_when_target_is_self() {
    assertThatThrownBy(() -> followService.unfollowUser(currentUser, currentUserId))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("cannot unfollow yourself");
  }

  @Test
  void getFollowStatus_returns_true_when_viewer_follows() {
    SocialUserFollowId id = new SocialUserFollowId(currentUserId, targetUserId);
    when(followRepository.existsById(id)).thenReturn(true);
    when(followRepository.countByIdFollowedUserId(targetUserId)).thenReturn(15L);

    FollowResponse response = followService.getFollowStatus(currentUser, targetUserId);

    assertThat(response.following()).isTrue();
    assertThat(response.followerCount()).isEqualTo(15L);
  }

  @Test
  void getFollowStatus_returns_false_when_viewer_is_null() {
    when(followRepository.countByIdFollowedUserId(targetUserId)).thenReturn(15L);

    FollowResponse response = followService.getFollowStatus(null, targetUserId);

    assertThat(response.following()).isFalse();
    assertThat(response.followerCount()).isEqualTo(15L);
    verify(followRepository, never()).existsById(any());
  }

  @Test
  void findFollowedUserIds_returns_followed_subset() {
    UUID otherTarget = UUID.randomUUID();
    SocialUserFollow follow1 =
        new SocialUserFollow(new SocialUserFollowId(currentUserId, targetUserId), Instant.now());
    when(followRepository.findByIdFollowerUserIdAndIdFollowedUserIdIn(
            currentUserId, List.of(targetUserId, otherTarget)))
        .thenReturn(List.of(follow1));

    Set<UUID> followed =
        followService.findFollowedUserIds(currentUserId, List.of(targetUserId, otherTarget));

    assertThat(followed).containsExactly(targetUserId);
  }

  @Test
  void findFollowedUserIds_returns_empty_when_inputs_empty_or_null() {
    assertThat(followService.findFollowedUserIds(null, List.of(targetUserId))).isEmpty();
    assertThat(followService.findFollowedUserIds(currentUserId, List.of())).isEmpty();
    assertThat(followService.findFollowedUserIds(currentUserId, null)).isEmpty();
  }
}
