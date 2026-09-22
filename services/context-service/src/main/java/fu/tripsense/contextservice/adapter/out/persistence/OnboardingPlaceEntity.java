package fu.tripsense.contextservice.adapter.out.persistence;

import fu.tripsense.contextservice.domain.PlaceIntent;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "onboarding_places")
class OnboardingPlaceEntity {
  @EmbeddedId OnboardingPlaceId id;

  @MapsId("profileId")
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "profile_id")
  OnboardingProfileEntity profile;

  @Column(name = "created_at", nullable = false)
  Instant createdAt;
}

@Embeddable
class OnboardingPlaceId implements java.io.Serializable {
  @Column(name = "profile_id")
  java.util.UUID profileId;

  @Column(name = "place_ref")
  String placeRef;

  @Enumerated(EnumType.STRING)
  @Column(name = "intent")
  PlaceIntent intent;

  OnboardingPlaceId() {}

  OnboardingPlaceId(java.util.UUID profileId, String placeRef, PlaceIntent intent) {
    this.profileId = profileId;
    this.placeRef = placeRef;
    this.intent = intent;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof OnboardingPlaceId that)) return false;
    return java.util.Objects.equals(profileId, that.profileId)
        && java.util.Objects.equals(placeRef, that.placeRef)
        && intent == that.intent;
  }

  @Override
  public int hashCode() {
    return java.util.Objects.hash(profileId, placeRef, intent);
  }
}
