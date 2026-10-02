package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerManagementClaim;
import fu.tripsense.tripservice.partner.enums.ManagementClaimState;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerManagementClaimRepository
    extends JpaRepository<PartnerManagementClaim, UUID> {

  List<PartnerManagementClaim> findByApplicantUserId(UUID applicantUserId);

  List<PartnerManagementClaim> findByTargetBusinessId(UUID targetBusinessId);

  List<PartnerManagementClaim> findByStateOrderByCreatedAtAsc(ManagementClaimState state);

  boolean existsByApplicantUserIdAndTargetBusinessIdAndStateIn(
      UUID applicantUserId, UUID targetBusinessId, Collection<ManagementClaimState> states);
}
