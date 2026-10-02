package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerCustomerQuota;
import fu.tripsense.tripservice.partner.entity.PartnerCustomerQuotaId;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerCustomerQuotaRepository
    extends JpaRepository<PartnerCustomerQuota, PartnerCustomerQuotaId> {

  Optional<PartnerCustomerQuota> findByIdCustomerIdAndIdQuotaDate(
      UUID customerId, LocalDate quotaDate);
}
