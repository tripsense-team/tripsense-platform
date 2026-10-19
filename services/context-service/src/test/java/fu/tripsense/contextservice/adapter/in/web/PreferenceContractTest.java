package fu.tripsense.contextservice.adapter.in.web;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import fu.tripsense.contextservice.application.*;
import fu.tripsense.contextservice.application.PreferenceDimensionCatalog.*;
import fu.tripsense.contextservice.application.PreferenceSignalReader.PreferenceSignal;
import fu.tripsense.contextservice.application.cache.*;
import fu.tripsense.contextservice.config.PreferenceCacheProperties;
import fu.tripsense.contextservice.security.*;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** MVC contract with the real principal resolver; no database or remote services. */
class PreferenceContractTest {
  private final PreferenceSignalReader signals = mock(PreferenceSignalReader.class);
  private final PreferenceDimensionCatalog catalog = mock(PreferenceDimensionCatalog.class);
  private final UUID userId = UUID.randomUUID();
  private final MockMvc mvc =
      MockMvcBuilders.standaloneSetup(
              new OnboardingController(
                  mock(OnboardingService.class), facade(), new CurrentUserProvider()))
          .setControllerAdvice(new RestExceptionHandler())
          .build();

  private CachedPreferencesService facade() {
    PreferenceSnapshotSource source =
        new PreferenceSnapshotSource() {
          public PreferenceSnapshot.Revision revision(UUID owner) {
            throw new AssertionError("cache disabled");
          }

          public PreferenceSnapshot load(UUID owner, String purpose) {
            return new PreferenceSnapshot(
                new PreferenceSnapshot.Revision(UUID.randomUUID(), 1, "COMPLETED", 1, "catalog"),
                purpose,
                signals.findForUser(owner).stream()
                    .filter(
                        signal ->
                            ("EXPLORE_RECOMMENDATION".equals(purpose)
                                    && "EXPLORE_AFFINITY".equals(signal.dimensionCode()))
                                || catalog
                                    .findActive(signal.dimensionCode())
                                    .map(d -> d.sensitivity() == Sensitivity.STANDARD)
                                    .orElse(false))
                    .toList());
          }
        };
    return new CachedPreferencesService(
        source,
        mock(PreferenceSnapshotCache.class),
        new PreferenceCacheProperties(),
        new SimpleMeterRegistry());
  }

  @BeforeEach
  void setup() {
    SecurityContextHolder.getContext()
        .setAuthentication(
            new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(userId, "test@example.invalid", "USER"), null, List.of()));
    when(catalog.findActive("FOOD_STYLE"))
        .thenReturn(
            Optional.of(
                new PreferenceDimension("FOOD_STYLE", Cardinality.MULTI, Sensitivity.STANDARD)));
    when(catalog.findActive("LOYALTY_PROGRAM"))
        .thenReturn(
            Optional.of(
                new PreferenceDimension(
                    "LOYALTY_PROGRAM", Cardinality.MULTI, Sensitivity.SENSITIVE)));
    when(catalog.findActive("EXPLORE_AFFINITY")).thenReturn(Optional.empty());
    when(signals.findForUser(userId))
        .thenReturn(
            List.of(
                signal("FOOD_STYLE", "CAFE", "ONBOARDING"),
                signal("LOYALTY_PROGRAM", "private", "ONBOARDING"),
                signal("EXPLORE_AFFINITY", "BEACH", "ONBOARDING_DERIVED_V1")));
  }

  @AfterEach
  void cleanup() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void planningIsRawArrayAndExcludesSensitiveAndExploreOnlyDimensions() throws Exception {
    mvc.perform(get("/api/context/preferences").param("purpose", "TRIP_PLANNING"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isArray())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].dimensionCode").value("FOOD_STYLE"))
        .andExpect(jsonPath("$[0].valueCode").value("CAFE"))
        .andExpect(jsonPath("$[0].confidence").value(1.0))
        .andExpect(jsonPath("$[0].source").value("ONBOARDING"))
        .andExpect(jsonPath("$[0].updatedAt").exists())
        .andExpect(jsonPath("$.data").doesNotExist());
  }

  @Test
  void exploreAllowsDerivedAffinityButNotSensitiveFields() throws Exception {
    mvc.perform(get("/api/context/preferences").param("purpose", "EXPLORE_RECOMMENDATION"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(
            jsonPath("$[*].dimensionCode")
                .value(org.hamcrest.Matchers.containsInAnyOrder("EXPLORE_AFFINITY", "FOOD_STYLE")));
  }

  @Test
  void emptyPreferencesAreAnEmptyArrayNotAnError() throws Exception {
    when(signals.findForUser(userId)).thenReturn(List.of());
    mvc.perform(get("/api/context/preferences"))
        .andExpect(status().isOk())
        .andExpect(content().json("[]"));
  }

  @Test
  void ownerAlwaysComesFromPrincipalNotCallerSuppliedUserId() throws Exception {
    mvc.perform(get("/api/context/preferences").param("userId", UUID.randomUUID().toString()))
        .andExpect(status().isOk());
    verify(signals).findForUser(userId);
    verifyNoMoreInteractions(signals);
  }

  @Test
  void missingPrincipalCannotReadSignals() throws Exception {
    SecurityContextHolder.clearContext();
    mvc.perform(get("/api/context/preferences")).andExpect(status().isUnauthorized());
    verifyNoInteractions(signals);
  }

  @Test
  void unsupportedPurposeIsRejectedBeforeReadingData() throws Exception {
    mvc.perform(get("/api/context/preferences").param("purpose", "ALL"))
        .andExpect(status().isBadRequest());
    verifyNoInteractions(signals);
  }

  @Test
  void admissionFailureReturnsSanitized503WithRetryAfter() throws Exception {
    when(signals.findForUser(userId)).thenThrow(new PreferencesBusyException());
    mvc.perform(get("/api/context/preferences"))
        .andExpect(status().isServiceUnavailable())
        .andExpect(header().string("Retry-After", "1"))
        .andExpect(jsonPath("$.code").value("PREFERENCES_BUSY"));
  }

  private static PreferenceSignal signal(String dimension, String value, String source) {
    return new PreferenceSignal(dimension, value, 1.0, source, Instant.EPOCH);
  }
}
