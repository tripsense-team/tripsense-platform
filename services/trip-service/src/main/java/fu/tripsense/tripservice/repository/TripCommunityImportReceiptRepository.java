package fu.tripsense.tripservice.repository;

import fu.tripsense.tripservice.entity.TripCommunityImportReceipt;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TripCommunityImportReceiptRepository
    extends JpaRepository<TripCommunityImportReceipt, UUID> {
  Optional<TripCommunityImportReceipt> findByUserIdAndIdempotencyKey(
      UUID userId, UUID idempotencyKey);
}
