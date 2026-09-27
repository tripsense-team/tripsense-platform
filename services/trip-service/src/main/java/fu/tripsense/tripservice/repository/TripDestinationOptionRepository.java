package fu.tripsense.tripservice.repository;

import fu.tripsense.tripservice.entity.TripDestinationOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TripDestinationOptionRepository extends JpaRepository<TripDestinationOption, UUID> {
    List<TripDestinationOption> findByTripIdOrderByCreatedAtAsc(UUID tripId);
}
