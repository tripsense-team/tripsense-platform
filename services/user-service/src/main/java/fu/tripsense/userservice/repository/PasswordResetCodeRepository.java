package fu.tripsense.userservice.repository;

import fu.tripsense.userservice.entity.PasswordResetCode;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PasswordResetCodeRepository extends JpaRepository<PasswordResetCode, UUID> {
  Optional<PasswordResetCode> findTopByUserIdOrderByCreatedAtDesc(UUID userId);
}
