package fu.tripsense.contextservice.adapter.out.persistence;

import fu.tripsense.contextservice.application.PreferenceSignalPublisher;
import fu.tripsense.contextservice.application.PreferenceSignalReader;
import fu.tripsense.contextservice.domain.OnboardingProfile;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class JpaPreferenceSignalPublisher
    implements PreferenceSignalPublisher, PreferenceSignalReader {
  private final SpringPreferenceSignalJpaRepository repository;

  public JpaPreferenceSignalPublisher(SpringPreferenceSignalJpaRepository repository) {
    this.repository = repository;
  }

  @Override
  public void replaceFor(OnboardingProfile profile) {
    repository.deleteByUserIdAndSource(profile.userId(), "ONBOARDING");
    Instant now = Instant.now();
    profile
        .selections()
        .forEach(
            (dimension, values) ->
                values.forEach(
                    value -> {
                      PreferenceSignalEntity signal = new PreferenceSignalEntity();
                      signal.id = UUID.randomUUID();
                      signal.userId = profile.userId();
                      signal.dimensionCode = dimension;
                      signal.valueCode = value;
                      signal.confidence = BigDecimal.valueOf(1.0);
                      signal.source = "ONBOARDING";
                      signal.sourceVersion = profile.version();
                      signal.updatedAt = now;
                      repository.save(signal);
                    }));
  }

  @Override
  public void deleteForUser(UUID userId) {
    repository.deleteByUserIdAndSource(userId, "ONBOARDING");
  }

  @Override
  public java.util.List<PreferenceSignal> findForUser(UUID userId) {
    return repository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
        .map(
            signal ->
                new PreferenceSignal(
                    signal.dimensionCode,
                    signal.valueCode,
                    signal.confidence != null ? signal.confidence.doubleValue() : 1.0,
                    signal.source,
                    signal.updatedAt))
        .toList();
  }
}
