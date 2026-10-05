package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerSupportCase;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PartnerSupportCaseRepository extends JpaRepository<PartnerSupportCase, UUID> {
  List<PartnerSupportCase> findByReporterIdOrderByCreatedAtDesc(UUID reporterId);

  List<PartnerSupportCase> findByAssignedAdminOrderByCreatedAtDesc(UUID assignedAdmin);

  List<PartnerSupportCase> findByStateOrderByCreatedAtDesc(String state);

  List<PartnerSupportCase> findAllByOrderByCreatedAtDesc();

  Optional<PartnerSupportCase> findByResourceTypeAndResourceId(String resourceType, UUID resourceId);
}
