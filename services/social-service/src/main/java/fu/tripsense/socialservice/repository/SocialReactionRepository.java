package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.SocialReaction;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SocialReactionRepository extends JpaRepository<SocialReaction, UUID> {
  boolean existsByUserIdAndTargetTypeAndTargetId(UUID userId, String targetType, UUID targetId);

  void deleteByUserIdAndTargetTypeAndTargetId(UUID userId, String targetType, UUID targetId);

  List<SocialReaction> findByUserIdAndTargetTypeAndTargetIdIn(
      UUID userId, String targetType, Collection<UUID> targetIds);

  long countByTargetTypeAndTargetId(String targetType, UUID targetId);
}
