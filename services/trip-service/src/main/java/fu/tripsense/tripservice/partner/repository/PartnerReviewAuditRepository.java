package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerReviewAudit;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerReviewAuditRepository extends JpaRepository<PartnerReviewAudit, UUID> {

  List<PartnerReviewAudit> findByBusinessIdOrderByOccurredAtDesc(UUID businessId);
}
