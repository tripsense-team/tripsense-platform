package fu.tripsense.userservice.repository;

import fu.tripsense.userservice.entity.TravelPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface TravelPreferenceRepository extends JpaRepository<TravelPreference, UUID> {
}
