package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerApplication;
import fu.tripsense.tripservice.partner.enums.ApplicationState;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerApplicationRepository extends JpaRepository<PartnerApplication, UUID> {

  List<PartnerApplication> findByBusinessIdOrderByRevisionDesc(UUID businessId);

  Optional<PartnerApplication> findTopByBusinessIdOrderByRevisionDesc(UUID businessId);

  Optional<PartnerApplication> findByBusinessIdAndRevision(UUID businessId, Integer revision);

  List<PartnerApplication> findByBusinessIdAndState(UUID businessId, ApplicationState state);

  List<PartnerApplication> findByStateOrderBySubmittedAtAsc(ApplicationState state);

  boolean existsByBusinessIdAndState(UUID businessId, ApplicationState state);
}
