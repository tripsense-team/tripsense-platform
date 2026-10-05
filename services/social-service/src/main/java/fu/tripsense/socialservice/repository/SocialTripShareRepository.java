package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.SocialTripShare;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SocialTripShareRepository extends JpaRepository<SocialTripShare, UUID> {

  Optional<SocialTripShare> findByAuthorIdAndSourceTripIdAndRemovedAtIsNull(
      UUID authorId, UUID sourceTripId);

  List<SocialTripShare> findByPostIdIn(Collection<UUID> postIds);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from SocialTripShare s where s.postId = :postId and s.removedAt is null")
  Optional<SocialTripShare> lockActiveByPostId(@Param("postId") UUID postId);

  @Query(
      "select lower(trim(s.destinationName)), count(s) from SocialTripShare s "
          + "where s.visibility = 'PUBLIC' and s.removedAt is null and s.destinationName is not null and trim(s.destinationName) <> '' "
          + "group by lower(trim(s.destinationName))")
  List<Object[]> countPublicTripSharesByDestination();
}
