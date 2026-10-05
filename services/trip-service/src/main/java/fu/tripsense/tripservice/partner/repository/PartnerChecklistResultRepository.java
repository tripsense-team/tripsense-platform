package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.ChecklistResultId;
import fu.tripsense.tripservice.partner.entity.PartnerChecklistResult;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerChecklistResultRepository
    extends JpaRepository<PartnerChecklistResult, ChecklistResultId> {

  List<PartnerChecklistResult> findByIdApplicationId(UUID applicationId);
}
