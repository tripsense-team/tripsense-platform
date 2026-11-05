package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerSubscriptionPlan;
import fu.tripsense.tripservice.partner.enums.BusinessKind;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerSubscriptionPlanRepository
    extends JpaRepository<PartnerSubscriptionPlan, String> {

  List<PartnerSubscriptionPlan> findByBusinessKindAndActiveOrderByDisplayOrderAsc(
      BusinessKind businessKind, boolean active);

  Optional<PartnerSubscriptionPlan> findByPlanIdAndActiveTrue(String planId);

  Optional<PartnerSubscriptionPlan> findByBusinessKindAndDurationDaysAndActiveTrue(
      BusinessKind businessKind, int durationDays);
}
