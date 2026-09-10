package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.SocialPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;

public interface SocialPostRepository extends JpaRepository<SocialPost, UUID> {

    @Query("""
            SELECT p FROM SocialPost p
            WHERE p.deletedAt IS NULL
            AND (
                p.postType = 'STANDARD'
                OR p.id IN (
                    SELECT s.postId FROM SocialTripShare s
                    WHERE s.visibility = 'PUBLIC' AND s.removedAt IS NULL
                )
            )
            """)
    Page<SocialPost> findPublicFeed(Pageable pageable);

    @Query("""
            SELECT p FROM SocialPost p
            WHERE p.authorId = :authorId AND p.deletedAt IS NULL
            AND (
                p.postType = 'STANDARD'
                OR p.id IN (
                    SELECT s.postId FROM SocialTripShare s
                    WHERE s.visibility = 'PUBLIC' AND s.removedAt IS NULL
                )
            )
            """)
    Page<SocialPost> findPublicPostsByAuthorId(@Param("authorId") UUID authorId, Pageable pageable);

    Page<SocialPost> findByAuthorIdAndDeletedAtIsNull(UUID authorId, Pageable pageable);

    Optional<SocialPost> findByIdAndDeletedAtIsNull(UUID id);

    Optional<SocialPost> findByAuthorIdAndIdempotencyKey(UUID authorId, UUID idempotencyKey);

    @Query(value = """
            INSERT INTO social_posts (id, author_id, author_display_name, author_email, idempotency_key, content, post_type, like_count, comment_count, created_at, updated_at)
            VALUES (:id, :authorId, :authorDisplayName, :authorEmail, :idempotencyKey, :content, :postType, 0, 0, :createdAt, :updatedAt)
            ON CONFLICT (author_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
            RETURNING id
            """, nativeQuery = true)
    UUID insertPostIfAbsent(@Param("id") UUID id, @Param("authorId") UUID authorId,
                             @Param("authorDisplayName") String authorDisplayName, @Param("authorEmail") String authorEmail,
                             @Param("idempotencyKey") UUID idempotencyKey, @Param("content") String content,
                             @Param("postType") String postType,
                             @Param("createdAt") java.time.Instant createdAt, @Param("updatedAt") java.time.Instant updatedAt);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from SocialPost p where p.id = :id and p.deletedAt is null")
    Optional<SocialPost> lockActiveById(@Param("id") UUID id);
}
