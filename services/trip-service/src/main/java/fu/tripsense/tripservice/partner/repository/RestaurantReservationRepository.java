package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.RestaurantReservation;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface RestaurantReservationRepository
    extends JpaRepository<RestaurantReservation, UUID> {

  Optional<RestaurantReservation> findByCustomerIdAndRequestKey(UUID customerId, String requestKey);

  Page<RestaurantReservation> findByCustomerIdOrderByCreatedAtDesc(UUID customerId, Pageable pageable);

  Page<RestaurantReservation> findByBusinessIdAndStateOrderByStartAtAsc(
      UUID businessId, String state, Pageable pageable);

  Page<RestaurantReservation> findByBusinessIdOrderByStartAtAsc(UUID businessId, Pageable pageable);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("SELECT r FROM RestaurantReservation r WHERE r.id = :id")
  Optional<RestaurantReservation> lockById(@Param("id") UUID id);
}
