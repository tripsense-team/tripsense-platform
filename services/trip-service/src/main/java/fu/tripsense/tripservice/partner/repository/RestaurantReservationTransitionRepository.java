package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.RestaurantReservationTransition;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RestaurantReservationTransitionRepository
    extends JpaRepository<RestaurantReservationTransition, UUID> {

  List<RestaurantReservationTransition> findByReservationIdOrderByCreatedAtAsc(UUID reservationId);
}
