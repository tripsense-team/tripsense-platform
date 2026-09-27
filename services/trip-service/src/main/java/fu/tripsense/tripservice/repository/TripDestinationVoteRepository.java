package fu.tripsense.tripservice.repository;

import fu.tripsense.tripservice.entity.TripDestinationVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TripDestinationVoteRepository extends JpaRepository<TripDestinationVote, UUID> {
    List<TripDestinationVote> findByTripDestinationOptionId(UUID optionId);
    int countByTripDestinationOptionId(UUID optionId);
    Optional<TripDestinationVote> findByTripDestinationOptionIdAndUserId(UUID optionId, UUID userId);
    boolean existsByTripDestinationOptionIdAndUserId(UUID optionId, UUID userId);
    void deleteByTripDestinationOptionIdAndUserId(UUID optionId, UUID userId);
}
