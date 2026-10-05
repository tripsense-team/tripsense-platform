package fu.tripsense.contextservice.adapter.out.persistence;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface SpringPreferenceDimensionJpaRepository
    extends JpaRepository<PreferenceDimensionEntity, String> {
  Optional<PreferenceDimensionEntity> findByCodeAndActiveTrue(String code);
}
