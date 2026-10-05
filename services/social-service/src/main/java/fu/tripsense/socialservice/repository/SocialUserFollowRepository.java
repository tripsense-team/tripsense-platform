package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.SocialUserFollow;
import fu.tripsense.socialservice.entity.SocialUserFollowId;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SocialUserFollowRepository
    extends JpaRepository<SocialUserFollow, SocialUserFollowId> {

  boolean existsById(SocialUserFollowId id);

  long countByIdFollowedUserId(UUID followedUserId);

  long countByIdFollowerUserId(UUID followerUserId);

  List<SocialUserFollow> findByIdFollowerUserIdAndIdFollowedUserIdIn(
      UUID followerUserId, Collection<UUID> followedUserIds);

  List<SocialUserFollow> findByIdFollowedUserId(UUID followedUserId);

  List<SocialUserFollow> findByIdFollowerUserId(UUID followerUserId);
}
