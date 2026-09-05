package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.SocialComment;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface SocialCommentRepository extends JpaRepository<SocialComment, UUID> {
    List<SocialComment> findByPostIdAndDeletedAtIsNullOrderByCreatedAtAsc(UUID postId);
    Optional<SocialComment> findByIdAndPostIdAndDeletedAtIsNull(UUID id, UUID postId);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select c from SocialComment c where c.id = :id and c.postId = :postId and c.deletedAt is null") Optional<SocialComment> lockActiveByIdAndPostId(@Param("id") UUID id, @Param("postId") UUID postId);
}
