package fu.tripsense.userservice.repository;

import fu.tripsense.userservice.entity.AuthVerificationCode;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuthVerificationCodeRepository
    extends JpaRepository<AuthVerificationCode, UUID> {

  Optional<AuthVerificationCode>
      findTopByUserEmailAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(
          String email, String purpose);

  Optional<AuthVerificationCode>
      findTopByUserIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(
          UUID userId, String purpose);

  Optional<AuthVerificationCode> findTopByUserIdAndPurposeOrderByCreatedAtDesc(
      UUID userId, String purpose);
}
