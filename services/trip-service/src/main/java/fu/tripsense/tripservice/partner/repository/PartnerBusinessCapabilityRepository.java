package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerBusinessCapability;
import fu.tripsense.tripservice.partner.entity.PartnerBusinessCapabilityId;
import fu.tripsense.tripservice.partner.enums.PartnerCapability;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerBusinessCapabilityRepository
    extends JpaRepository<PartnerBusinessCapability, PartnerBusinessCapabilityId> {

  List<PartnerBusinessCapability> findByIdBusinessId(UUID businessId);

  Optional<PartnerBusinessCapability> findByIdBusinessIdAndIdCapability(
      UUID businessId, PartnerCapability capability);

  boolean existsByIdBusinessIdAndIdCapabilityAndRevokedAtIsNull(
      UUID businessId, PartnerCapability capability);
}
