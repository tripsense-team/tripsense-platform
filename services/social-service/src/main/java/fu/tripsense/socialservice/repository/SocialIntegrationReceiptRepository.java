package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.SocialIntegrationReceipt;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SocialIntegrationReceiptRepository extends JpaRepository<SocialIntegrationReceipt, UUID> {}
