package fu.tripsense.tripservice.repository;

import fu.tripsense.tripservice.entity.ItineraryItem;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ItineraryItemRepository extends JpaRepository<ItineraryItem, UUID> {

    List<ItineraryItem> findByTripIdAndDayIdOrderBySortOrderAsc(UUID tripId, UUID dayId);

    List<ItineraryItem> findByDayIdOrderBySortOrderAsc(UUID dayId);

    Optional<ItineraryItem> findByIdAndTripId(UUID id, UUID tripId);

    boolean existsByTripIdAndDayIdIn(UUID tripId, Collection<UUID> dayIds);

    @Query("select coalesce(max(i.sortOrder), 0) from ItineraryItem i where i.tripId = :tripId and i.dayId = :dayId")
    int maxSortOrderByTripIdAndDayId(@Param("tripId") UUID tripId, @Param("dayId") UUID dayId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from ItineraryItem i where i.tripId = :tripId and i.dayId = :dayId order by i.sortOrder asc")
    List<ItineraryItem> findByTripIdAndDayIdForUpdate(@Param("tripId") UUID tripId, @Param("dayId") UUID dayId);
}
