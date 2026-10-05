package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.CommentLike;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommentLikeRepository
    extends JpaRepository<CommentLike, CommentLike.CommentLikeId> {
  List<CommentLike> findByIdCommentIdInAndIdUserId(Collection<UUID> commentIds, UUID userId);
}
