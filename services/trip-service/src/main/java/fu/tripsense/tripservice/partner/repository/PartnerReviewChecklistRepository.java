package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.ChecklistId;
import fu.tripsense.tripservice.partner.entity.PartnerReviewChecklist;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerReviewChecklistRepository
    extends JpaRepository<PartnerReviewChecklist, ChecklistId> {

  List<PartnerReviewChecklist> findByKindOrderByEffectiveAtDesc(String kind);
}
