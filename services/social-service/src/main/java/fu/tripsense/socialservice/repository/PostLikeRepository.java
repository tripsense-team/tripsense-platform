package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.PostLike;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface PostLikeRepository extends JpaRepository<PostLike, PostLike.PostLikeId> { boolean existsById(PostLike.PostLikeId id); List<PostLike> findByIdPostIdInAndIdUserId(Collection<UUID> postIds, UUID userId); }
