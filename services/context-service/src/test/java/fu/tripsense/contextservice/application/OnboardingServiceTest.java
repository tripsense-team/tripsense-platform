package fu.tripsense.contextservice.application;

import static org.junit.jupiter.api.Assertions.*;

import fu.tripsense.contextservice.domain.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class OnboardingServiceTest {
  @Test
  void
      completed_profile_edits_replace_signals_and_delete_removes_them_without_affecting_other_users() {
    InMemoryProfiles profiles = new InMemoryProfiles();
    Map<UUID, Map<String, Set<String>>> published = new HashMap<>();
    PreferenceSignalPublisher publisher =
        new PreferenceSignalPublisher() {
          public void replaceFor(OnboardingProfile profile) {
            published.put(profile.userId(), Map.copyOf(profile.selections()));
          }

          public void deleteForUser(UUID userId) {
            published.remove(userId);
          }
        };
    OnboardingService service =
        new OnboardingService(profiles, publisher, new TestCatalog(), new RecordingOutbox());
    UUID userId = UUID.randomUUID();
    UUID other = UUID.randomUUID();
    published.put(other, Map.of("FOOD_STYLE", Set.of("LOCAL_FOOD")));
    OnboardingProfile draft =
        service.save(
            userId, new OnboardingCommand(0, Map.of("FOOD_STYLE", Set.of("CAFE")), Map.of()));
    assertFalse(published.containsKey(userId));
    // Simulate a legacy profile completed before numeric budgets were introduced.
    draft.complete(draft.version());
    OnboardingProfile completed = service.complete(userId, draft.version());
    assertEquals(Set.of("CAFE"), published.get(userId).get("FOOD_STYLE"));
    service.save(
        userId,
        new OnboardingCommand(
            completed.version(), Map.of("ACTIVITY_INTEREST", Set.of("BEACH")), Map.of()));
    assertEquals(Map.of("ACTIVITY_INTEREST", Set.of("BEACH")), published.get(userId));
    service.delete(userId);
    assertTrue(service.find(userId).isEmpty());
    assertFalse(published.containsKey(userId));
    assertTrue(published.containsKey(other));
  }

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
                Map.of("BUDGET_TIER", Set.of("MID_RANGE"), "DAILY_BUDGET_VND", Set.of("700000"),
                    "ACTIVITY_INTEREST", Set.of("HIKING")),
                Map.of(PlaceIntent.VISITED, Set.of("place:da-lat"))));
    assertEquals(1, saved.version());
    assertTrue(signals.published.isEmpty());
    OnboardingProfile complete = service.complete(userId, saved.version());
    assertEquals(OnboardingStatus.COMPLETED, complete.status());
    assertEquals(1, signals.published.size());
    assertEquals(2, outbox.events.size());
    assertDoesNotThrow(() -> service.complete(userId, saved.version()));
    assertEquals(2, signals.published.size());
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

  @Test
  void requiresBudgetAtFirstCompletionAndKeepsCompletedAmount() {
    var service = new OnboardingService(new InMemoryProfiles(), new RecordingSignals(),
        new TestCatalog(), new RecordingOutbox());
    UUID user = UUID.randomUUID();
    var draft = service.save(user, new OnboardingCommand(0,
        Map.of("BUDGET_TIER", Set.of("MID_RANGE")), Map.of()));
    assertThrows(IllegalArgumentException.class, () -> service.complete(user, draft.version()));
    assertEquals(OnboardingStatus.IN_PROGRESS, draft.status());
    var saved = service.save(user, new OnboardingCommand(draft.version(),
        Map.of("BUDGET_TIER", Set.of("MID_RANGE"), "DAILY_BUDGET_VND", Set.of("700000")), Map.of()));
    var completed = service.complete(user, saved.version());
    assertThrows(IllegalArgumentException.class, () -> service.save(user,
        new OnboardingCommand(completed.version(), Map.of("BUDGET_TIER", Set.of("MID_RANGE")), Map.of())));
    assertEquals(Set.of("700000"), service.find(user).orElseThrow().selections().get("DAILY_BUDGET_VND"));
  }

  @Test
  void validatesBudgetAsCanonicalBoundedWholeVnd() {
    var service = new OnboardingService(new InMemoryProfiles(), new RecordingSignals(),
        new TestCatalog(), new RecordingOutbox());
    for (String value : List.of("0", "-1", "1.5", "1e6", "01", "1000000001", "999999999999999999999")) {
      assertThrows(IllegalArgumentException.class, () -> service.save(UUID.randomUUID(),
          new OnboardingCommand(0, Map.of("DAILY_BUDGET_VND", Set.of(value)), Map.of())));
    }
    for (String value : List.of("1", "1000000000")) {
      assertDoesNotThrow(() -> service.save(UUID.randomUUID(),
          new OnboardingCommand(0, Map.of("DAILY_BUDGET_VND", Set.of(value)), Map.of())));
    }
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
                  "DAILY_BUDGET_VND",
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
                  Set.of("TRAVEL_PARTY", "BUDGET_TIER", "DAILY_BUDGET_VND").contains(code)
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
