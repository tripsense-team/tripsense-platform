package fu.tripsense.contextservice.adapter.out.persistence;

import fu.tripsense.contextservice.application.OnboardingProfileRepository;
import fu.tripsense.contextservice.domain.*;
import fu.tripsense.contextservice.security.FreeTextCryptoService;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Repository;

@Repository
public class JpaOnboardingProfileRepository implements OnboardingProfileRepository {
  private final SpringOnboardingProfileJpaRepository repository;
  private final FreeTextCryptoService crypto;

  public JpaOnboardingProfileRepository(
      SpringOnboardingProfileJpaRepository repository, FreeTextCryptoService crypto) {
    this.repository = repository;
    this.crypto = crypto;
  }

  @Override
  public Optional<OnboardingProfile> findByUserId(UUID userId) {
    return repository.findByUserId(userId).map(this::toDomain);
  }

  @Override
  public OnboardingProfile save(OnboardingProfile profile) {
    return toDomain(repository.saveAndFlush(toEntity(profile)));
  }

  @Override
  public void deleteByUserId(UUID userId) {
    repository.deleteByUserId(userId);
  }

  private OnboardingProfile toDomain(OnboardingProfileEntity entity) {
    Map<String, Set<String>> selections = new HashMap<>();
    entity.selections.forEach(
        s ->
            selections
                .computeIfAbsent(s.id.dimensionCode, ignored -> new HashSet<>())
                .add(s.id.valueCode));
    Map<PlaceIntent, Set<String>> places = new EnumMap<>(PlaceIntent.class);
    entity.places.forEach(
        p -> places.computeIfAbsent(p.id.intent, ignored -> new HashSet<>()).add(p.id.placeRef));

    Map<String, String> attributes = new HashMap<>();
    if (entity.attributes != null) {
      entity.attributes.forEach(a -> attributes.put(a.id.attributeCode, a.valueJson));
    }

    String freeText = null;
    if (entity.freeTextEntity != null && entity.freeTextEntity.ciphertext != null) {
      if (entity.freeTextEntity.expiresAt == null
          || entity.freeTextEntity.expiresAt.isAfter(Instant.now())) {
        freeText = crypto.decrypt(entity.freeTextEntity.ciphertext);
      }
    }

    return new OnboardingProfile(
        entity.id,
        entity.userId,
        entity.version,
        entity.status,
        entity.schemaVersion,
        entity.consentRevision,
        entity.completedAt,
        entity.updatedAt,
        selections,
        places,
        attributes,
        freeText);
  }

  private OnboardingProfileEntity toEntity(OnboardingProfile profile) {
    OnboardingProfileEntity entity =
        repository.findById(profile.id()).orElseGet(OnboardingProfileEntity::new);
    // Hibernate owns @Version. The domain already compared the client version; Hibernate
    // supplies the second, database-level compare-and-swap for concurrent requests.
    entity.id = profile.id();
    entity.userId = profile.userId();
    entity.status = profile.status();
    entity.schemaVersion = profile.schemaVersion();
    entity.consentRevision = profile.consentRevision();
    entity.completedAt = profile.completedAt();
    entity.updatedAt = profile.updatedAt();
    if (entity.createdAt == null) entity.createdAt = Instant.now();

    Set<OnboardingSelectionId> incomingSelectionIds = new HashSet<>();
    profile.selections().forEach((dimension, values) -> {
        values.forEach(value -> incomingSelectionIds.add(new OnboardingSelectionId(entity.id, dimension, value)));
    });
    entity.selections.removeIf(s -> !incomingSelectionIds.contains(s.id));
    profile.selections().forEach((dimension, values) -> {
        values.forEach(value -> {
            OnboardingSelectionId id = new OnboardingSelectionId(entity.id, dimension, value);
            if (entity.selections.stream().noneMatch(s -> s.id.equals(id))) {
                OnboardingSelectionEntity row = new OnboardingSelectionEntity();
                row.id = id;
                row.profile = entity;
                row.createdAt = Instant.now();
                entity.selections.add(row);
            }
        });
    });

    Set<OnboardingPlaceId> incomingPlaceIds = new HashSet<>();
    profile.places().forEach((intent, refs) -> {
        refs.forEach(ref -> incomingPlaceIds.add(new OnboardingPlaceId(entity.id, ref, intent)));
    });
    entity.places.removeIf(p -> !incomingPlaceIds.contains(p.id));
    profile.places().forEach((intent, refs) -> {
        refs.forEach(ref -> {
            OnboardingPlaceId id = new OnboardingPlaceId(entity.id, ref, intent);
            if (entity.places.stream().noneMatch(p -> p.id.equals(id))) {
                OnboardingPlaceEntity row = new OnboardingPlaceEntity();
                row.id = id;
                row.profile = entity;
                row.createdAt = Instant.now();
                entity.places.add(row);
            }
        });
    });

    Set<OnboardingAttributeId> incomingAttributeIds = new HashSet<>();
    if (profile.attributes() != null) {
        profile.attributes().forEach((code, json) -> {
            if (code != null && json != null) {
                incomingAttributeIds.add(new OnboardingAttributeId(entity.id, code));
            }
        });
    }
    entity.attributes.removeIf(a -> !incomingAttributeIds.contains(a.id));
    if (profile.attributes() != null) {
        profile.attributes().forEach((code, json) -> {
            if (code != null && json != null) {
                OnboardingAttributeId id = new OnboardingAttributeId(entity.id, code);
                OnboardingAttributeEntity attr = entity.attributes.stream().filter(a -> a.id.equals(id)).findFirst().orElse(null);
                if (attr == null) {
                    attr = new OnboardingAttributeEntity();
                    attr.id = id;
                    attr.profile = entity;
                    attr.valueSchemaVersion = 1;
                    attr.sensitivityClass = "STANDARD";
                    entity.attributes.add(attr);
                }
                attr.valueJson = json;
                attr.updatedAt = Instant.now();
            }
        });
    }

    String plainFreeText = profile.freeText();
    if (plainFreeText != null && !plainFreeText.trim().isEmpty()) {
      byte[] cipher = crypto.encrypt(plainFreeText.trim());
      if (cipher != null) {
        if (entity.freeTextEntity == null) {
          entity.freeTextEntity = new OnboardingFreeTextEntity();
          entity.freeTextEntity.profileId = entity.id;
          entity.freeTextEntity.profile = entity;
          entity.freeTextEntity.createdAt = Instant.now();
        }
        entity.freeTextEntity.ciphertext = cipher;
        entity.freeTextEntity.encryptionKeyRef = FreeTextCryptoService.KEY_REF;
        entity.freeTextEntity.purposeConsentRevision = "v1";
        entity.freeTextEntity.expiresAt = Instant.now().plus(Duration.ofDays(180));
      }
    } else {
      entity.freeTextEntity = null;
    }

    return entity;
  }
}
