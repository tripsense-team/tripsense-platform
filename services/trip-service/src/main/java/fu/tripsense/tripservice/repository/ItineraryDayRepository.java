package fu.tripsense.tripservice.repository;

import fu.tripsense.tripservice.entity.ItineraryDay;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ItineraryDayRepository extends JpaRepository<ItineraryDay, UUID> {

    List<ItineraryDay> findByTripIdOrderByDayNumberAsc(UUID tripId);

    Optional<ItineraryDay> findByIdAndTripId(UUID id, UUID tripId);

    List<ItineraryDay> findByTripIdAndDayDateBeforeOrTripIdAndDayDateAfter(
            UUID tripIdBefore,
            LocalDate before,
            UUID tripIdAfter,
            LocalDate after
    );

    List<ItineraryDay> findByTripIdAndDayDateBetween(UUID tripId, LocalDate startDate, LocalDate endDate);

    void deleteByTripIdAndIdIn(UUID tripId, Collection<UUID> ids);

    boolean existsByTripIdAndDayDate(UUID tripId, LocalDate dayDate);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from ItineraryDay d where d.id = :id and d.tripId = :tripId")
    Optional<ItineraryDay> findByIdAndTripIdForUpdate(@Param("id") UUID id, @Param("tripId") UUID tripId);
}
