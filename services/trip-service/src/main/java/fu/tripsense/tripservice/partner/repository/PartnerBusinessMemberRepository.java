package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerBusinessMember;
import fu.tripsense.tripservice.partner.entity.PartnerBusinessMemberId;
import fu.tripsense.tripservice.partner.enums.MembershipRole;
import fu.tripsense.tripservice.partner.enums.MembershipState;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerBusinessMemberRepository
    extends JpaRepository<PartnerBusinessMember, PartnerBusinessMemberId> {

  Optional<PartnerBusinessMember> findByIdBusinessIdAndIdUserId(UUID businessId, UUID userId);

  List<PartnerBusinessMember> findByIdUserIdAndState(UUID userId, MembershipState state);

  List<PartnerBusinessMember> findByIdBusinessIdAndState(UUID businessId, MembershipState state);

  boolean existsByIdBusinessIdAndIdUserIdAndState(
      UUID businessId, UUID userId, MembershipState state);

  boolean existsByIdBusinessIdAndIdUserIdAndRoleAndState(
      UUID businessId, UUID userId, MembershipRole role, MembershipState state);
}
