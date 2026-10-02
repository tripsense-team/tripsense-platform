package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerGuidePromotionMedia;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerGuidePromotionMediaRepository
    extends JpaRepository<PartnerGuidePromotionMedia, UUID> {

  List<PartnerGuidePromotionMedia> findByBusinessId(UUID businessId);

  Optional<PartnerGuidePromotionMedia> findByIdAndBusinessId(UUID id, UUID businessId);
}
