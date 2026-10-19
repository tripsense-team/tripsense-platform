package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.RestaurantAvailability;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface RestaurantAvailabilityRepository extends JpaRepository<RestaurantAvailability, UUID> {

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("SELECT a FROM RestaurantAvailability a WHERE a.businessId = :businessId")
  Optional<RestaurantAvailability> lockByBusinessId(@Param("businessId") UUID businessId);
}
