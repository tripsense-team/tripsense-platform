package fu.tripsense.contextservice.adapter.out.persistence;

import fu.tripsense.contextservice.application.PreferenceDimensionCatalog;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class JpaPreferenceDimensionCatalog implements PreferenceDimensionCatalog {
  private final SpringPreferenceDimensionJpaRepository repository;

  public JpaPreferenceDimensionCatalog(SpringPreferenceDimensionJpaRepository repository) {
    this.repository = repository;
  }

  @Override
  public Optional<PreferenceDimension> findActive(String code) {
    return repository
        .findByCodeAndActiveTrue(code)
        .map(
            row ->
                new PreferenceDimension(
                    row.code,
                    Cardinality.valueOf(row.cardinality),
                    Sensitivity.valueOf(row.sensitivityClass)));
  }
}
