package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.NotificationRealtimeOutbox;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationRealtimeOutboxRepository
    extends JpaRepository<NotificationRealtimeOutbox, UUID> {

  Optional<NotificationRealtimeOutbox> findByNotificationId(UUID notificationId);

  @Query("SELECT o FROM NotificationRealtimeOutbox o "
      + "WHERE o.publishedAt IS NULL "
      + "AND o.nextAttemptAt <= :now "
      + "AND (o.leaseUntil IS NULL OR o.leaseUntil < :now) "
      + "ORDER BY o.createdAt ASC")
  List<NotificationRealtimeOutbox> findPendingForPublish(
      @Param("now") Instant now, Pageable pageable);
}
