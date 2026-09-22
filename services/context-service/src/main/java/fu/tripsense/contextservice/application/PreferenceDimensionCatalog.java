package fu.tripsense.contextservice.application;

import java.util.Optional;

/**
 * Backend-owned catalog makes adding a new preference dimension a data migration, not a code fork.
 */
public interface PreferenceDimensionCatalog {
  Optional<PreferenceDimension> findActive(String code);

  record PreferenceDimension(String code, Cardinality cardinality, Sensitivity sensitivity) {}

  enum Cardinality {
    SINGLE,
    MULTI
  }

  enum Sensitivity {
    STANDARD,
    SENSITIVE
  }
}
