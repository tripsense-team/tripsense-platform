package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerOutbox;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerOutboxRepository extends JpaRepository<PartnerOutbox, UUID> {

  @Query(
      """
      SELECT o FROM PartnerOutbox o
      WHERE o.processedAt IS NULL
        AND o.deadLetter = false
        AND o.nextAttempt <= :now
      ORDER BY o.createdAt ASC
      LIMIT 50
      """)
  List<PartnerOutbox> findDueEvents(Instant now);
}
