package fu.tripsense.contextservice.adapter.out.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface SpringPreferenceSignalJpaRepository extends JpaRepository<PreferenceSignalEntity, UUID> {
  void deleteByUserIdAndSource(UUID userId, String source);

  List<PreferenceSignalEntity> findByUserIdOrderByUpdatedAtDesc(UUID userId);
}
