package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.PostLike;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostLikeRepository extends JpaRepository<PostLike, PostLike.PostLikeId> {
  boolean existsById(PostLike.PostLikeId id);

  List<PostLike> findByIdPostIdInAndIdUserId(Collection<UUID> postIds, UUID userId);
}
