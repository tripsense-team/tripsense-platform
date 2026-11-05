package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.RentalBookingOrder;
import fu.tripsense.tripservice.partner.enums.RentalBookingStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RentalBookingOrderRepository extends JpaRepository<RentalBookingOrder, UUID> {

  Optional<RentalBookingOrder> findByBookingCode(String bookingCode);

  List<RentalBookingOrder> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);

  Page<RentalBookingOrder> findByBusinessIdOrderByCreatedAtDesc(UUID businessId, Pageable pageable);

  Page<RentalBookingOrder> findByBusinessIdAndStatusInOrderByCreatedAtDesc(
      UUID businessId, Collection<RentalBookingStatus> statuses, Pageable pageable);

  @Query(
      "SELECT COALESCE(SUM(b.quantity), 0) FROM RentalBookingOrder b "
          + "WHERE b.rentalItemId = :rentalItemId "
          + "AND b.status IN ('CONFIRMED', 'IN_USE', 'PENDING') "
          + "AND b.pickupAt < :rangeEnd AND b.returnAt > :rangeStart")
  int calculateOverlappingAllocatedQuantity(
      @Param("rentalItemId") UUID rentalItemId,
      @Param("rangeStart") Instant rangeStart,
      @Param("rangeEnd") Instant rangeEnd);
}

