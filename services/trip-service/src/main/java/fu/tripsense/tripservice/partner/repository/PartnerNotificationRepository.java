package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerNotification;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerNotificationRepository extends JpaRepository<PartnerNotification, UUID> {

  List<PartnerNotification> findByRecipientIdOrderByCreatedAtDesc(UUID recipientId);

  List<PartnerNotification> findByRecipientIdAndReadAtIsNullOrderByCreatedAtDesc(UUID recipientId);

  Optional<PartnerNotification> findByIdAndRecipientId(UUID id, UUID recipientId);
}
