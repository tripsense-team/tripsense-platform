package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.SocialPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;

public interface SocialPostRepository extends JpaRepository<SocialPost, UUID> {
    Page<SocialPost> findByDeletedAtIsNull(Pageable pageable);
    Page<SocialPost> findByAuthorIdAndDeletedAtIsNull(UUID authorId, Pageable pageable);
    Optional<SocialPost> findByIdAndDeletedAtIsNull(UUID id);
    Optional<SocialPost> findByAuthorIdAndIdempotencyKey(UUID authorId, UUID idempotencyKey);
    @Query(value = """
            INSERT INTO social_posts (id, author_id, author_display_name, author_email, idempotency_key, content, like_count, comment_count, created_at, updated_at)
            VALUES (:id, :authorId, :authorDisplayName, :authorEmail, :idempotencyKey, :content, 0, 0, :createdAt, :updatedAt)
            ON CONFLICT (author_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
            RETURNING id
            """, nativeQuery = true)
    UUID insertPostIfAbsent(@Param("id") UUID id, @Param("authorId") UUID authorId,
                             @Param("authorDisplayName") String authorDisplayName, @Param("authorEmail") String authorEmail,
                             @Param("idempotencyKey") UUID idempotencyKey, @Param("content") String content,
                             @Param("createdAt") java.time.Instant createdAt, @Param("updatedAt") java.time.Instant updatedAt);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select p from SocialPost p where p.id = :id and p.deletedAt is null") Optional<SocialPost> lockActiveById(@Param("id") UUID id);
}
