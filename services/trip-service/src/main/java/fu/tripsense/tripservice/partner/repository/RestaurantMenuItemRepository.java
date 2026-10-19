package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.RestaurantMenuItem;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RestaurantMenuItemRepository extends JpaRepository<RestaurantMenuItem, UUID> {
  List<RestaurantMenuItem> findByBusinessIdOrderByDisplayOrderAscNameAsc(UUID businessId);

  List<RestaurantMenuItem> findByBusinessIdAndAvailableTrueOrderByDisplayOrderAscNameAsc(UUID businessId);

  boolean existsByBusinessIdAndImagePublicId(UUID businessId, String imagePublicId);

  @Modifying
  @Query("DELETE FROM RestaurantMenuItem r WHERE r.businessId = :businessId")
  void deleteByBusinessId(@Param("businessId") UUID businessId);
}
