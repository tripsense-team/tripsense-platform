package fu.tripsense.socialservice.service.impl;

import fu.tripsense.socialservice.dto.response.FollowResponse;
import fu.tripsense.socialservice.entity.SocialUserFollow;
import fu.tripsense.socialservice.entity.SocialUserFollowId;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.SocialUserFollowRepository;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import fu.tripsense.socialservice.service.SocialFollowService;
import java.time.Instant;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class SocialFollowServiceImpl implements SocialFollowService {

  private final SocialUserFollowRepository followRepository;

  @Override
  @Transactional
  public FollowResponse followUser(AuthenticatedUser currentUser, UUID targetUserId) {
    if (targetUserId == null) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST, "INVALID_TARGET_USER", "Target user ID cannot be null");
    }
    if (currentUser.id().equals(targetUserId)) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST, "CANNOT_FOLLOW_SELF", "You cannot follow yourself");
    }

    SocialUserFollowId id = new SocialUserFollowId(currentUser.id(), targetUserId);
    if (!followRepository.existsById(id)) {
      followRepository.save(SocialUserFollow.builder().id(id).createdAt(Instant.now()).build());
      log.info("User {} followed user {}", currentUser.id(), targetUserId);
    }

    long followerCount = followRepository.countByIdFollowedUserId(targetUserId);
    return new FollowResponse(true, followerCount);
  }

  @Override
  @Transactional
  public FollowResponse unfollowUser(AuthenticatedUser currentUser, UUID targetUserId) {
    if (targetUserId == null) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST, "INVALID_TARGET_USER", "Target user ID cannot be null");
    }
    if (currentUser.id().equals(targetUserId)) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST, "CANNOT_FOLLOW_SELF", "You cannot unfollow yourself");
    }

    SocialUserFollowId id = new SocialUserFollowId(currentUser.id(), targetUserId);
    if (followRepository.existsById(id)) {
      followRepository.deleteById(id);
      log.info("User {} unfollowed user {}", currentUser.id(), targetUserId);
    }

    long followerCount = followRepository.countByIdFollowedUserId(targetUserId);
    return new FollowResponse(false, followerCount);
  }

  @Override
  @Transactional(readOnly = true)
  public FollowResponse getFollowStatus(AuthenticatedUser currentUserOrNull, UUID targetUserId) {
    if (targetUserId == null) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST, "INVALID_TARGET_USER", "Target user ID cannot be null");
    }

    boolean isFollowing =
        currentUserOrNull != null
            && followRepository.existsById(
                new SocialUserFollowId(currentUserOrNull.id(), targetUserId));
    long followerCount = followRepository.countByIdFollowedUserId(targetUserId);

    return new FollowResponse(isFollowing, followerCount);
  }

  @Override
  @Transactional(readOnly = true)
  public Set<UUID> findFollowedUserIds(UUID followerUserId, Collection<UUID> targetUserIds) {
    if (followerUserId == null || targetUserIds == null || targetUserIds.isEmpty()) {
      return Set.of();
    }

    return followRepository
        .findByIdFollowerUserIdAndIdFollowedUserIdIn(followerUserId, targetUserIds)
        .stream()
        .map(f -> f.getId().getFollowedUserId())
        .collect(Collectors.toSet());
  }
}
