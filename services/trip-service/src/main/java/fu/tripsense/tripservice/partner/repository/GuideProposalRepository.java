package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.GuideProposal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GuideProposalRepository extends JpaRepository<GuideProposal, UUID> {

  List<GuideProposal> findByInquiryIdOrderByRevisionDesc(UUID inquiryId);

  Optional<GuideProposal> findByInquiryIdAndRevision(UUID inquiryId, Integer revision);

  long countByInquiryId(UUID inquiryId);
}
