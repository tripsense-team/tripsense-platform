package fu.tripsense.tripservice.repository;

import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.enums.TripStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;
import java.util.UUID;

public interface TripRepository extends JpaRepository<Trip, UUID>, JpaSpecificationExecutor<Trip> {

    Optional<Trip> findByIdAndOwnerUserIdAndArchivedAtIsNull(UUID id, UUID ownerUserId);

    Page<Trip> findByOwnerUserIdAndArchivedAtIsNull(UUID ownerUserId, Pageable pageable);

    Page<Trip> findByOwnerUserIdAndStatusAndArchivedAtIsNull(UUID ownerUserId, TripStatus status, Pageable pageable);
}
