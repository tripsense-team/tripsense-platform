package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerDocument;
import fu.tripsense.tripservice.partner.enums.DocumentScanState;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerDocumentRepository extends JpaRepository<PartnerDocument, UUID> {

  List<PartnerDocument> findByBusinessId(UUID businessId);

  List<PartnerDocument> findByClaimId(UUID claimId);

  Optional<PartnerDocument> findByIdAndBusinessId(UUID id, UUID businessId);

  Optional<PartnerDocument> findByIdAndClaimId(UUID id, UUID claimId);

  List<PartnerDocument> findByBusinessIdAndScanState(UUID businessId, DocumentScanState scanState);
}
