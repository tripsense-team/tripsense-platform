package fu.tripsense.socialservice.service;

import fu.tripsense.socialservice.dto.response.FollowResponse;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;

public interface SocialFollowService {

  FollowResponse followUser(AuthenticatedUser currentUser, UUID targetUserId);

  FollowResponse unfollowUser(AuthenticatedUser currentUser, UUID targetUserId);

  FollowResponse getFollowStatus(AuthenticatedUser currentUserOrNull, UUID targetUserId);

  Set<UUID> findFollowedUserIds(UUID followerUserId, Collection<UUID> targetUserIds);
}
