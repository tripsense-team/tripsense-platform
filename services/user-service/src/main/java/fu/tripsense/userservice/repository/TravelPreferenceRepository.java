package fu.tripsense.userservice.repository;

import fu.tripsense.userservice.entity.TravelPreference;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TravelPreferenceRepository extends JpaRepository<TravelPreference, UUID> {}
