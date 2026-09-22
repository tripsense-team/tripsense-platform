package fu.tripsense.contextservice.adapter.out.persistence;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "onboarding_attributes")
class OnboardingAttributeEntity {
  @EmbeddedId OnboardingAttributeId id;

  @MapsId("profileId")
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "profile_id")
  OnboardingProfileEntity profile;

  @Column(name = "value_json", nullable = false, columnDefinition = "jsonb")
  @JdbcTypeCode(SqlTypes.JSON)
  String valueJson;

  @Column(name = "value_schema_version", nullable = false)
  int valueSchemaVersion = 1;

  @Column(name = "sensitivity_class", nullable = false)
  String sensitivityClass = "STANDARD";

  @Column(name = "updated_at", nullable = false)
  Instant updatedAt = Instant.now();
}

@Embeddable
class OnboardingAttributeId implements Serializable {
  @Column(name = "profile_id")
  UUID profileId;

  @Column(name = "attribute_code")
  String attributeCode;

  OnboardingAttributeId() {}

  OnboardingAttributeId(UUID profileId, String attributeCode) {
    this.profileId = profileId;
    this.attributeCode = attributeCode;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof OnboardingAttributeId that)) return false;
    return Objects.equals(profileId, that.profileId) && Objects.equals(attributeCode, that.attributeCode);
  }

  @Override
  public int hashCode() {
    return Objects.hash(profileId, attributeCode);
  }
}
