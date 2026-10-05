package fu.tripsense.contextservice.adapter.out.persistence;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "onboarding_free_text")
class OnboardingFreeTextEntity {
  @Id
  @Column(name = "profile_id")
  UUID profileId;

  @MapsId
  @OneToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "profile_id")
  OnboardingProfileEntity profile;

  @Column(name = "ciphertext", nullable = false)
  byte[] ciphertext;

  @Column(name = "encryption_key_ref", nullable = false)
  String encryptionKeyRef;

  @Column(name = "purpose_consent_revision", nullable = false)
  String purposeConsentRevision;

  @Column(name = "expires_at", nullable = false)
  Instant expiresAt;

  @Column(name = "created_at", nullable = false)
  Instant createdAt = Instant.now();
}
