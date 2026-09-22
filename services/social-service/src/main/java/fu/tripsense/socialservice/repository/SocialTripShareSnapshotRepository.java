package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.SocialTripShareSnapshot;
import fu.tripsense.socialservice.entity.SocialTripShareSnapshotId;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SocialTripShareSnapshotRepository
    extends JpaRepository<SocialTripShareSnapshot, SocialTripShareSnapshotId> {
  Optional<SocialTripShareSnapshot> findByPostIdAndSnapshotVersion(
      UUID postId, Integer snapshotVersion);

  Optional<SocialTripShareSnapshot> findByPostIdAndRefreshIdempotencyKey(
      UUID postId, UUID refreshIdempotencyKey);
}
