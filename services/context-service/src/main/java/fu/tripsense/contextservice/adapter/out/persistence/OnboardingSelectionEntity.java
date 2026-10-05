package fu.tripsense.contextservice.adapter.out.persistence;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "onboarding_selections")
class OnboardingSelectionEntity {
  @EmbeddedId OnboardingSelectionId id;

  @MapsId("profileId")
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "profile_id")
  OnboardingProfileEntity profile;

  @Column(name = "created_at", nullable = false)
  Instant createdAt;
}

@Embeddable
class OnboardingSelectionId implements java.io.Serializable {
  @Column(name = "profile_id")
  java.util.UUID profileId;

  @Column(name = "dimension_code")
  String dimensionCode;

  @Column(name = "value_code")
  String valueCode;

  OnboardingSelectionId() {}

  OnboardingSelectionId(java.util.UUID profileId, String dimensionCode, String valueCode) {
    this.profileId = profileId;
    this.dimensionCode = dimensionCode;
    this.valueCode = valueCode;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof OnboardingSelectionId that)) return false;
    return java.util.Objects.equals(profileId, that.profileId)
        && java.util.Objects.equals(dimensionCode, that.dimensionCode)
        && java.util.Objects.equals(valueCode, that.valueCode);
  }

  @Override
  public int hashCode() {
    return java.util.Objects.hash(profileId, dimensionCode, valueCode);
  }
}
