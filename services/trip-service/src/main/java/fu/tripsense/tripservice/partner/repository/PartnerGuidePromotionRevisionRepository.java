package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerGuidePromotionRevision;
import fu.tripsense.tripservice.partner.enums.ApplicationState;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerGuidePromotionRevisionRepository
    extends JpaRepository<PartnerGuidePromotionRevision, UUID> {

  List<PartnerGuidePromotionRevision> findByPromotionIdOrderByRevisionNumberDesc(UUID promotionId);

  Optional<PartnerGuidePromotionRevision> findFirstByPromotionIdOrderByRevisionNumberDesc(
      UUID promotionId);

  List<PartnerGuidePromotionRevision> findByStateOrderByCreatedAtDesc(ApplicationState state);
}
