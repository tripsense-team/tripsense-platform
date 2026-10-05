package fu.tripsense.contextservice.adapter.out.persistence;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface SpringOnboardingProfileJpaRepository
    extends JpaRepository<OnboardingProfileEntity, UUID> {
  Optional<OnboardingProfileEntity> findByUserId(UUID userId);

  void deleteByUserId(UUID userId);
}
