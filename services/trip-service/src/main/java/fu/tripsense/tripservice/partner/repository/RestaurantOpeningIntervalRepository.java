package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.RestaurantOpeningInterval;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RestaurantOpeningIntervalRepository extends JpaRepository<RestaurantOpeningInterval, UUID> {

  List<RestaurantOpeningInterval> findByBusinessIdOrderByDayOfWeekAscOpensAtAsc(UUID businessId);

  void deleteByBusinessId(UUID businessId);
}
