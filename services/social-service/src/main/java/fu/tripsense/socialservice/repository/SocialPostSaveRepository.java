package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.SocialPostSave;
import fu.tripsense.socialservice.entity.SocialPostSaveId;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SocialPostSaveRepository
    extends JpaRepository<SocialPostSave, SocialPostSaveId> {

  List<SocialPostSave> findByIdUserIdAndIdPostIdIn(UUID userId, Collection<UUID> postIds);

  @Modifying
  @Query(
      value =
          """
          insert into social_post_saves (user_id, post_id, created_at)
          values (:userId, :postId, :createdAt)
          on conflict (user_id, post_id) do nothing
          """,
      nativeQuery = true)
  int insertIfAbsent(
      @Param("userId") UUID userId,
      @Param("postId") UUID postId,
      @Param("createdAt") Instant createdAt);

  @Query(
      """
      select s from SocialPostSave s
      join SocialPost p on p.id = s.id.postId
      join SocialTripShare t on t.postId = p.id
      where s.id.userId = :userId
        and p.deletedAt is null
        and p.postType = 'TRIP_SHARE'
        and t.removedAt is null
        and (t.visibility <> 'PRIVATE' or t.authorId = :userId)
        and (:beforeCreatedAt is null
          or s.createdAt < :beforeCreatedAt
          or (s.createdAt = :beforeCreatedAt and s.id.postId < :beforePostId))
      order by s.createdAt desc, s.id.postId desc
      """)
  List<SocialPostSave> findAccessibleTripShares(
      @Param("userId") UUID userId,
      @Param("beforeCreatedAt") Instant beforeCreatedAt,
      @Param("beforePostId") UUID beforePostId,
      Pageable pageable);
}
