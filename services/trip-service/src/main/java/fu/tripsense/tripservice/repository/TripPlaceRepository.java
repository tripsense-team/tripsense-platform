package fu.tripsense.tripservice.repository;

import fu.tripsense.tripservice.entity.TripPlace;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TripPlaceRepository extends JpaRepository<TripPlace, UUID> {
  Optional<TripPlace> findByTripIdAndPlaceRef(UUID tripId, String placeRef);

  List<TripPlace> findByTripIdInAndPlaceRefIn(
      Collection<UUID> tripIds, Collection<String> placeRefs);

  Page<TripPlace> findByTripIdOrderByCreatedAtDesc(UUID tripId, Pageable pageable);

  void deleteByTripIdAndPlaceRef(UUID tripId, String placeRef);
}
