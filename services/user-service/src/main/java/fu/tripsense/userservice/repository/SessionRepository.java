package fu.tripsense.userservice.repository;

import fu.tripsense.userservice.entity.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SessionRepository extends JpaRepository<Session, UUID> {

    Optional<Session> findByIdAndRevokedAtIsNull(UUID id);

    List<Session> findByUserIdAndRevokedAtIsNull(UUID userId);
}
