package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerBusiness;
import fu.tripsense.tripservice.partner.enums.BusinessKind;
import fu.tripsense.tripservice.partner.enums.PublicationState;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerBusinessRepository extends JpaRepository<PartnerBusiness, UUID> {

  List<PartnerBusiness> findByOwnerUserId(UUID ownerUserId);

  List<PartnerBusiness> findByKindAndPublicationState(BusinessKind kind, PublicationState state);

  Optional<PartnerBusiness> findByOwnerUserIdAndKind(UUID ownerUserId, BusinessKind kind);

  boolean existsByOwnerUserIdAndKind(UUID ownerUserId, BusinessKind kind);

  List<PartnerBusiness> findByDisplayNameContainingIgnoreCase(String displayName);
}
