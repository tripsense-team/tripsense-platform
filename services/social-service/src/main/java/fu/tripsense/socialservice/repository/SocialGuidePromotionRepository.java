package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.SocialGuidePromotion;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SocialGuidePromotionRepository extends JpaRepository<SocialGuidePromotion, UUID> {

  Optional<SocialGuidePromotion> findBySourcePromotionId(UUID sourcePromotionId);

  List<SocialGuidePromotion> findByPostIdIn(List<UUID> postIds);

  List<SocialGuidePromotion> findBySourcePromotionIdIn(List<UUID> sourcePromotionIds);

  Page<SocialGuidePromotion> findByDistributionEnabledTrueAndRemovedAtIsNull(Pageable pageable);
}
