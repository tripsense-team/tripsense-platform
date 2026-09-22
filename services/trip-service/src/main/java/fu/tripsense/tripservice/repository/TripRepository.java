package fu.tripsense.tripservice.repository;

import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.enums.TripStatus;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface TripRepository extends JpaRepository<Trip, UUID>, JpaSpecificationExecutor<Trip> {

  Optional<Trip> findByIdAndOwnerUserIdAndArchivedAtIsNull(UUID id, UUID ownerUserId);

  Page<Trip> findByOwnerUserIdAndArchivedAtIsNull(UUID ownerUserId, Pageable pageable);

  Page<Trip> findByOwnerUserIdAndStatusAndArchivedAtIsNull(
      UUID ownerUserId, TripStatus status, Pageable pageable);

  Page<Trip> findByOwnerUserIdAndVisibilityAndArchivedAtIsNull(
      UUID ownerUserId, String visibility, Pageable pageable);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select t from Trip t where t.id = :id and t.ownerUserId = :owner and t.archivedAt is null")
  Optional<Trip> findOwnedForUpdate(@Param("id") UUID id, @Param("owner") UUID ownerUserId);
}
