package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.GuideInquiryRequirements;
import fu.tripsense.tripservice.partner.entity.GuideInquiryRequirementsId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GuideInquiryRequirementsRepository
    extends JpaRepository<GuideInquiryRequirements, GuideInquiryRequirementsId> {

  List<GuideInquiryRequirements> findByIdInquiryIdOrderByIdRevisionDesc(UUID inquiryId);

  Optional<GuideInquiryRequirements> findByIdInquiryIdAndIdRevision(
      UUID inquiryId, Integer revision);
}
