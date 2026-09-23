package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.SocialReport;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SocialReportRepository extends JpaRepository<SocialReport, UUID> {
  boolean existsByReporterIdAndTargetTypeAndTargetId(
      UUID reporterId, String targetType, UUID targetId);

  long countByReporterIdAndCreatedAtAfter(UUID reporterId, Instant after);

  Page<SocialReport> findByStatusOrderByCreatedAtAsc(String status, Pageable pageable);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select r from SocialReport r where r.id = :id")
  Optional<SocialReport> lockById(@Param("id") UUID id);
}
