package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerInvitation;
import fu.tripsense.tripservice.partner.enums.InvitationState;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerInvitationRepository extends JpaRepository<PartnerInvitation, UUID> {

  Optional<PartnerInvitation> findByTokenHash(String tokenHash);

  Optional<PartnerInvitation> findByBusinessIdAndRecipientEmailIgnoreCaseAndState(
      UUID businessId, String recipientEmail, InvitationState state);

  List<PartnerInvitation> findByBusinessIdAndState(UUID businessId, InvitationState state);
}
