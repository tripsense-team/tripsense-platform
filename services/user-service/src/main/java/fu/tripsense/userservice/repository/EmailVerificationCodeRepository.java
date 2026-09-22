package fu.tripsense.userservice.repository;

import fu.tripsense.userservice.entity.EmailVerificationCode;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EmailVerificationCodeRepository
    extends JpaRepository<EmailVerificationCode, UUID> {

  Optional<EmailVerificationCode> findTopByUserEmailAndVerifiedAtIsNullOrderByCreatedAtDesc(
      String email);

  Optional<EmailVerificationCode> findTopByUserIdAndVerifiedAtIsNullOrderByCreatedAtDesc(
      UUID userId);
}
