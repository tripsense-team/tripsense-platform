package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.RestaurantMenuItem;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RestaurantMenuItemRepository extends JpaRepository<RestaurantMenuItem, UUID> {
  List<RestaurantMenuItem> findByBusinessIdOrderByDisplayOrderAscNameAsc(UUID businessId);

  List<RestaurantMenuItem> findByBusinessIdAndAvailableTrueOrderByDisplayOrderAscNameAsc(UUID businessId);

  void deleteByBusinessId(UUID businessId);
}
