package fu.tripsense.tripservice.repository;

import fu.tripsense.tripservice.entity.CollaborationChangeEvent;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CollaborationChangeEventRepository
    extends JpaRepository<CollaborationChangeEvent, UUID> {

  List<CollaborationChangeEvent> findByTripIdAndRevisionGreaterThanOrderByRevisionAsc(
      UUID tripId, long revision, Pageable pageable);

  Optional<CollaborationChangeEvent> findFirstByTripIdOrderByRevisionAsc(UUID tripId);

  List<CollaborationChangeEvent> findByExpiresAtBeforeOrderByExpiresAtAsc(
      Instant cutoff, Pageable pageable);
}
