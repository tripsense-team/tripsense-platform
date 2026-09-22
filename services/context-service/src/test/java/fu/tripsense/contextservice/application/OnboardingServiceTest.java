package fu.tripsense.contextservice.application;

import static org.junit.jupiter.api.Assertions.*;

import fu.tripsense.contextservice.domain.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class OnboardingServiceTest {
  @Test
  void replaces_answers_at_expected_version_and_publishes_only_on_completion() {
    InMemoryProfiles profiles = new InMemoryProfiles();
    RecordingSignals signals = new RecordingSignals();
    RecordingOutbox outbox = new RecordingOutbox();
    OnboardingService service = new OnboardingService(profiles, signals, new TestCatalog(), outbox);
    UUID userId = UUID.randomUUID();
    OnboardingProfile started = service.start(userId);
    OnboardingProfile saved =
        service.save(
            userId,
            new OnboardingCommand(
                started.version(),
                Map.of("BUDGET_TIER", Set.of("MID_RANGE"), "ACTIVITY_INTEREST", Set.of("HIKING")),
                Map.of(PlaceIntent.VISITED, Set.of("place:da-lat"))));
    assertEquals(1, saved.version());
    assertTrue(signals.published.isEmpty());
    OnboardingProfile complete = service.complete(userId, saved.version());
    assertEquals(OnboardingStatus.COMPLETED, complete.status());
    assertEquals(1, signals.published.size());
    assertEquals(2, outbox.events.size());
    assertDoesNotThrow(() -> service.complete(userId, saved.version()));
    assertEquals(1, signals.published.size());
  }

  @Test
  void rejects_stale_or_unsupported_answers() {
    InMemoryProfiles profiles = new InMemoryProfiles();
    OnboardingService service =
        new OnboardingService(
            profiles, new RecordingSignals(), new TestCatalog(), new RecordingOutbox());
    UUID userId = UUID.randomUUID();
    service.start(userId);
    assertThrows(
        VersionConflictException.class,
        () -> service.save(userId, new OnboardingCommand(1, Map.of(), Map.of())));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            service.save(
                userId,
                new OnboardingCommand(0, Map.of("VOICE_PERSONA", Set.of("FUNNY")), Map.of())));
  }

  @Test
  void saves_attributes_and_free_text_and_rejects_exceeding_lengths() {
    InMemoryProfiles profiles = new InMemoryProfiles();
    OnboardingService service =
        new OnboardingService(
            profiles, new RecordingSignals(), new TestCatalog(), new RecordingOutbox());
    UUID userId = UUID.randomUUID();
    OnboardingProfile started = service.start(userId);

    OnboardingProfile saved =
        service.save(
            userId,
            new OnboardingCommand(
                started.version(),
                Map.of("BUDGET_TIER", Set.of("MID_RANGE")),
                Map.of(),
                Map.of("HOME_CITY", "{\"name\":\"TP. Hồ Chí Minh\"}"),
                "I love quiet cafes and film photography."));

    assertEquals("I love quiet cafes and film photography.", saved.freeText());
    assertEquals("{\"name\":\"TP. Hồ Chí Minh\"}", saved.attributes().get("HOME_CITY"));

    String longText = "a".repeat(2001);
    assertThrows(
        IllegalArgumentException.class,
        () ->
            service.save(
                userId,
                new OnboardingCommand(
                    saved.version(),
                    Map.of("BUDGET_TIER", Set.of("MID_RANGE")),
                    Map.of(),
                    Map.of(),
                    longText)));
  }

  private static final class InMemoryProfiles implements OnboardingProfileRepository {
    private final Map<UUID, OnboardingProfile> profiles = new HashMap<>();

    public Optional<OnboardingProfile> findByUserId(UUID userId) {
      return Optional.ofNullable(profiles.get(userId));
    }

    public OnboardingProfile save(OnboardingProfile profile) {
      profiles.put(profile.userId(), profile);
      return profile;
    }

    public void deleteByUserId(UUID userId) {
      profiles.remove(userId);
    }
  }

  private static final class RecordingSignals implements PreferenceSignalPublisher {
    private final List<UUID> published = new ArrayList<>();

    public void replaceFor(OnboardingProfile profile) {
      published.add(profile.userId());
    }

    public void deleteForUser(UUID userId) {
      published.removeIf(userId::equals);
    }
  }

  private static final class TestCatalog implements PreferenceDimensionCatalog {
    public Optional<PreferenceDimension> findActive(String code) {
      return Set.of(
                  "TRAVEL_PARTY",
                  "BUDGET_TIER",
                  "SPLURGE_CATEGORY",
                  "STAY_STYLE",
                  "LOYALTY_PROGRAM",
                  "FOOD_STYLE",
                  "DIETARY_RESTRICTION",
                  "ACTIVITY_INTEREST")
              .contains(code)
          ? Optional.of(
              new PreferenceDimension(
                  code,
                  Set.of("TRAVEL_PARTY", "BUDGET_TIER").contains(code)
                      ? Cardinality.SINGLE
                      : Cardinality.MULTI,
                  Set.of("LOYALTY_PROGRAM", "DIETARY_RESTRICTION").contains(code)
                      ? Sensitivity.SENSITIVE
                      : Sensitivity.STANDARD))
          : Optional.empty();
    }
  }

  private static final class RecordingOutbox implements ContextEventOutbox {
    private final List<UUID> events = new ArrayList<>();

    public void recordProfileChanged(OnboardingProfile profile) {
      events.add(profile.id());
    }
  }
}
