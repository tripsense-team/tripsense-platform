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

  @Query("SELECT r FROM RestaurantReservation r WHERE r.businessId = :businessId "
      + "AND r.startAt < :rangeEnd AND r.endsAt > :rangeStart "
      + "AND (r.state = 'CONFIRMED' OR (r.state = 'REQUESTED' AND r.holdExpiresAt > :now))")
  java.util.List<RestaurantReservation> findActiveOverlappingReservations(
      @Param("businessId") UUID businessId,
      @Param("rangeStart") java.time.Instant rangeStart,
      @Param("rangeEnd") java.time.Instant rangeEnd,
      @Param("now") java.time.Instant now);

  @Query("SELECT r FROM RestaurantReservation r WHERE r.state = 'REQUESTED' AND r.holdExpiresAt <= :now")
  java.util.List<RestaurantReservation> findExpiredHolds(
      @Param("now") java.time.Instant now,
      Pageable pageable);

  @Query("SELECT r FROM RestaurantReservation r WHERE r.businessId = :businessId "
      + "AND r.endsAt > :now "
      + "AND (r.state = 'CONFIRMED' OR (r.state = 'REQUESTED' AND r.holdExpiresAt > :now))")
  java.util.List<RestaurantReservation> findFutureActiveReservations(
      @Param("businessId") UUID businessId,
      @Param("now") java.time.Instant now);
}
