package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.SocialTripShare;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SocialTripShareRepository extends JpaRepository<SocialTripShare, UUID> {

    Optional<SocialTripShare> findByAuthorIdAndSourceTripIdAndRemovedAtIsNull(UUID authorId, UUID sourceTripId);

    List<SocialTripShare> findByPostIdIn(Collection<UUID> postIds);

    boolean existsByAuthorIdAndSourceTripIdAndRemovedAtIsNull(UUID authorId, UUID sourceTripId);
}
