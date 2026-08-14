package fu.tripsense.userservice.repository;

import fu.tripsense.userservice.entity.RefreshToken;
import org.springframework.data.jpa.repository.EntityGraph;
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
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    @EntityGraph(attributePaths = {"session", "session.user"})
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @EntityGraph(attributePaths = {"session", "session.user"})
    Optional<RefreshToken> findByTokenHashAndRevokedAtIsNull(String tokenHash);

    List<RefreshToken> findBySessionUserIdAndRevokedAtIsNull(UUID userId);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE RefreshToken rt SET rt.revokedAt = :now WHERE rt.session.id IN (SELECT s.id FROM Session s WHERE s.user.id = :userId) AND rt.revokedAt IS NULL")
    int revokeAllByUserId(@Param("userId") UUID userId, @Param("now") LocalDateTime now);
}
