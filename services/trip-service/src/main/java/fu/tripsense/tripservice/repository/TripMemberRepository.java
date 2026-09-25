package fu.tripsense.tripservice.repository;

import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.entity.TripMember;
import fu.tripsense.tripservice.enums.TripMemberRole;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TripMemberRepository extends JpaRepository<TripMember, UUID> {

  List<TripMember> findByTripId(UUID tripId);

  Optional<TripMember> findByTripIdAndUserId(UUID tripId, UUID userId);

  boolean existsByTripIdAndUserId(UUID tripId, UUID userId);

  void deleteByTripIdAndUserId(UUID tripId, UUID userId);

  List<TripMember> findByUserId(UUID userId);

  @Query("SELECT m.trip FROM TripMember m WHERE m.userId = :userId AND m.trip.archivedAt IS NULL")
  Page<Trip> findTripsByMemberUserId(@Param("userId") UUID userId, Pageable pageable);

  Optional<TripMember> findByTripIdAndUserIdAndRole(UUID tripId, UUID userId, TripMemberRole role);
}
