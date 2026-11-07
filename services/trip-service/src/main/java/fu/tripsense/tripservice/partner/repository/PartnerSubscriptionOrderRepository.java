package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerSubscriptionOrder;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerSubscriptionOrderRepository
    extends JpaRepository<PartnerSubscriptionOrder, UUID> {

  Optional<PartnerSubscriptionOrder> findByOrderCode(Long orderCode);

  List<PartnerSubscriptionOrder> findByBusinessIdOrderByCreatedAtDesc(UUID businessId);
}
