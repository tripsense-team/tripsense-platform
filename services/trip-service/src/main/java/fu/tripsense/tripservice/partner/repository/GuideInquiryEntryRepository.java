package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.GuideInquiryEntry;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GuideInquiryEntryRepository extends JpaRepository<GuideInquiryEntry, UUID> {

  List<GuideInquiryEntry> findByInquiryIdOrderBySeqAsc(UUID inquiryId);

  long countByInquiryId(UUID inquiryId);
}
