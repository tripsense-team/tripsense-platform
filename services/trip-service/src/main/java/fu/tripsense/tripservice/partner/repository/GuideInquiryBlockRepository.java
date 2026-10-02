package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.GuideInquiryBlock;
import fu.tripsense.tripservice.partner.entity.GuideInquiryBlockId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GuideInquiryBlockRepository
    extends JpaRepository<GuideInquiryBlock, GuideInquiryBlockId> {

  List<GuideInquiryBlock> findByIdGuideBusinessIdAndIsActiveTrue(UUID guideBusinessId);

  List<GuideInquiryBlock> findByIdCustomerIdAndIsActiveTrue(UUID customerId);

  List<GuideInquiryBlock> findByIdGuideBusinessIdAndIdCustomerIdAndIsActiveTrue(
      UUID guideBusinessId, UUID customerId);

  Optional<GuideInquiryBlock> findFirstByIdGuideBusinessIdAndIdCustomerIdAndIsActiveTrue(
      UUID guideBusinessId, UUID customerId);
}
