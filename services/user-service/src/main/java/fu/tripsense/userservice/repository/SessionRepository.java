package fu.tripsense.userservice.repository;

import fu.tripsense.userservice.entity.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SessionRepository extends JpaRepository<Session, UUID> {

    Optional<Session> findByIdAndRevokedAtIsNull(UUID id);

    List<Session> findByUserIdAndRevokedAtIsNull(UUID userId);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE Session s SET s.revokedAt = :now WHERE s.user.id = :userId AND s.revokedAt IS NULL")
    int revokeAllByUserId(@Param("userId") UUID userId, @Param("now") LocalDateTime now);
}
