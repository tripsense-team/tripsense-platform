package fu.tripsense.contextservice.domain;

import java.time.Instant;
import java.util.*;

/** Aggregate root. It protects a user's versioned onboarding answers. */
public final class OnboardingProfile {
  private final UUID id;
  private final UUID userId;
  private long version;
  private OnboardingStatus status;
  private final int schemaVersion;
  private final int consentRevision;
  private Instant completedAt;
  private Instant updatedAt;
  private final Map<String, Set<String>> selections;
  private final Map<PlaceIntent, Set<String>> places;
  private final Map<String, String> attributes;
  private String freeText;

  public OnboardingProfile(
      UUID id,
      UUID userId,
      long version,
      OnboardingStatus status,
      int schemaVersion,
      int consentRevision,
      Instant completedAt,
      Instant updatedAt,
      Map<String, Set<String>> selections,
      Map<PlaceIntent, Set<String>> places) {
    this(
        id,
        userId,
        version,
        status,
        schemaVersion,
        consentRevision,
        completedAt,
        updatedAt,
        selections,
        places,
        Map.of(),
        null);
  }

  public OnboardingProfile(
      UUID id,
      UUID userId,
      long version,
      OnboardingStatus status,
      int schemaVersion,
      int consentRevision,
      Instant completedAt,
      Instant updatedAt,
      Map<String, Set<String>> selections,
      Map<PlaceIntent, Set<String>> places,
      Map<String, String> attributes,
      String freeText) {
    this.id = id;
    this.userId = userId;
    this.version = version;
    this.status = status;
    this.schemaVersion = schemaVersion;
    this.consentRevision = consentRevision;
    this.completedAt = completedAt;
    this.updatedAt = updatedAt;
    this.selections = copySelections(selections != null ? selections : Map.of());
    this.places = copyPlaces(places != null ? places : Map.of());
    this.attributes = new HashMap<>(attributes != null ? attributes : Map.of());
    this.freeText = freeText;
  }

  public static OnboardingProfile start(UUID userId) {
    return new OnboardingProfile(
        UUID.randomUUID(),
        userId,
        0,
        OnboardingStatus.IN_PROGRESS,
        1,
        0,
        null,
        Instant.now(),
        Map.of(),
        Map.of(),
        Map.of(),
        null);
  }

  public void replaceAnswers(
      Map<String, Set<String>> newSelections,
      Map<PlaceIntent, Set<String>> newPlaces,
      long expectedVersion) {
    replaceAnswers(newSelections, newPlaces, Map.of(), null, expectedVersion);
  }

  public void replaceAnswers(
      Map<String, Set<String>> newSelections,
      Map<PlaceIntent, Set<String>> newPlaces,
      Map<String, String> newAttributes,
      String newFreeText,
      long expectedVersion) {
    requireVersion(expectedVersion);
    selections.clear();
    selections.putAll(copySelections(newSelections != null ? newSelections : Map.of()));
    places.clear();
    places.putAll(copyPlaces(newPlaces != null ? newPlaces : Map.of()));
    attributes.clear();
    if (newAttributes != null) {
      attributes.putAll(newAttributes);
    }
    this.freeText = (newFreeText != null && !newFreeText.trim().isEmpty()) ? newFreeText.trim() : null;
    version++;
    updatedAt = Instant.now();
  }

  /**
   * Completion is deliberately idempotent: a lost response must not create duplicate AI signals.
   */
  public void complete(long expectedVersion) {
    if (status == OnboardingStatus.COMPLETED) return;
    requireVersion(expectedVersion);
    status = OnboardingStatus.COMPLETED;
    completedAt = Instant.now();
    version++;
    updatedAt = Instant.now();
  }

  private void requireVersion(long expectedVersion) {
    if (version != expectedVersion) throw new VersionConflictException();
  }

  private static Map<String, Set<String>> copySelections(Map<String, Set<String>> values) {
    Map<String, Set<String>> result = new TreeMap<>();
    values.forEach((key, value) -> result.put(key, new TreeSet<>(value)));
    return result;
  }

  private static Map<PlaceIntent, Set<String>> copyPlaces(Map<PlaceIntent, Set<String>> values) {
    Map<PlaceIntent, Set<String>> result = new EnumMap<>(PlaceIntent.class);
    values.forEach((key, value) -> result.put(key, new TreeSet<>(value)));
    return result;
  }

  public UUID id() {
    return id;
  }

  public UUID userId() {
    return userId;
  }

  public long version() {
    return version;
  }

  public OnboardingStatus status() {
    return status;
  }

  public int schemaVersion() {
    return schemaVersion;
  }

  public int consentRevision() {
    return consentRevision;
  }

  public Instant completedAt() {
    return completedAt;
  }

  public Instant updatedAt() {
    return updatedAt;
  }

  public Map<String, Set<String>> selections() {
    return Collections.unmodifiableMap(copySelections(selections));
  }

  public Map<PlaceIntent, Set<String>> places() {
    return Collections.unmodifiableMap(copyPlaces(places));
  }

  public Map<String, String> attributes() {
    return Collections.unmodifiableMap(new HashMap<>(attributes));
  }

  public String freeText() {
    return freeText;
  }
}
