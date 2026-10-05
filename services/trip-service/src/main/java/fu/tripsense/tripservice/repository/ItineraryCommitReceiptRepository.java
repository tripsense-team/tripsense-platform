package fu.tripsense.tripservice.repository;

import fu.tripsense.tripservice.entity.ItineraryCommitReceipt;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItineraryCommitReceiptRepository
    extends JpaRepository<ItineraryCommitReceipt, UUID> {
  Optional<ItineraryCommitReceipt> findByOwnerUserIdAndIdempotencyKey(
      UUID ownerUserId, String idempotencyKey);
}
