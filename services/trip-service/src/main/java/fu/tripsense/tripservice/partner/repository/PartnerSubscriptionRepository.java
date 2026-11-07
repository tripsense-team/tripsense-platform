package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerSubscription;
import fu.tripsense.tripservice.partner.enums.SubscriptionStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerSubscriptionRepository
    extends JpaRepository<PartnerSubscription, UUID> {

  Optional<PartnerSubscription> findByBusinessId(UUID businessId);

  List<PartnerSubscription> findByStatusAndValidToBefore(
      SubscriptionStatus status, Instant cutoff);

  List<PartnerSubscription> findByStatusAndValidToBetween(
      SubscriptionStatus status, Instant start, Instant end);
}
