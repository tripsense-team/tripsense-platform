package fu.tripsense.contextservice.adapter.out.persistence;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "preference_signals")
class PreferenceSignalEntity {
  @Id UUID id;

  @Column(name = "user_id", nullable = false)
  UUID userId;

  @Column(name = "dimension_code", nullable = false)
  String dimensionCode;

  @Column(name = "value_code", nullable = false)
  String valueCode;

  @Column(nullable = false)
  BigDecimal confidence;

  @Column(nullable = false)
  String source;

  @Column(name = "source_version", nullable = false)
  long sourceVersion;

  @Column(name = "updated_at", nullable = false)
  Instant updatedAt;
}
