package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerGuidePromotion;
import fu.tripsense.tripservice.partner.enums.PublicationState;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerGuidePromotionRepository extends JpaRepository<PartnerGuidePromotion, UUID> {

  List<PartnerGuidePromotion> findByBusinessId(UUID businessId);

  List<PartnerGuidePromotion> findByPublicationState(PublicationState state);

  Optional<PartnerGuidePromotion> findByIdAndBusinessId(UUID id, UUID businessId);
}
