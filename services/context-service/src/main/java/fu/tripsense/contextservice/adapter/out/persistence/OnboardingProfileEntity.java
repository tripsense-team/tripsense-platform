package fu.tripsense.contextservice.adapter.out.persistence;

import fu.tripsense.contextservice.domain.OnboardingStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "onboarding_profiles")
class OnboardingProfileEntity {
  @Id UUID id;

  @Column(name = "user_id", nullable = false, unique = true)
  UUID userId;

  @Version long version;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  OnboardingStatus status;

  @Column(name = "schema_version", nullable = false)
  int schemaVersion;

  @Column(name = "consent_revision", nullable = false)
  int consentRevision;

  @Column(name = "completed_at")
  Instant completedAt;

  @Column(name = "created_at", nullable = false)
  Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  Instant updatedAt;

  @OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true)
  Set<OnboardingSelectionEntity> selections = new HashSet<>();

  @OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true)
  Set<OnboardingPlaceEntity> places = new HashSet<>();

  @OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true)
  Set<OnboardingAttributeEntity> attributes = new HashSet<>();

  @OneToOne(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true)
  OnboardingFreeTextEntity freeTextEntity;
}
