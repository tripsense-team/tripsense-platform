package fu.tripsense.recommendation.adapter.out.http;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

import fu.tripsense.recommendation.application.RecommendationCommand;
import fu.tripsense.recommendation.application.TripContextNotAccessibleException;
import fu.tripsense.recommendation.application.port.ObservedHistoryReader;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.UserProfileSnapshot;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class RemoteRecommendationContextProviderTest {
  @Test
  void readsBudgetSeparatelyFromCategoriesAndIgnoresMalformedAmount() {
    properties.getProfile().setObservedHistoryEnabled(false);
    context("[" + signal("DAILY_BUDGET_VND", "700000", "ONBOARDING", "1") + ","
        + signal("BUDGET_TIER", "MID_RANGE", "ONBOARDING", "1") + "]");
    var profile = provider().resolve(command("EXPLORE_RECOMMENDATION", null)).profile();
    assertThat(profile.dailyBudgetVnd()).isEqualTo(700000L);
    assertThat(profile.budgetTier()).isEqualTo("MID_RANGE");
    assertThat(profile.preferredCategories()).isEmpty();
    assertThat(profile.categoryAffinities()).isEmpty();
    assertThat(profile.personalizationSignalCount()).isEqualTo(1);
    server.verify();
  }

  @Test
  void invalidBudgetDoesNotDiscardValidCategoryPreferences() {
    properties.getProfile().setObservedHistoryEnabled(false);
    context("[" + signal("DAILY_BUDGET_VND", "99999999999999", "ONBOARDING", "1") + ","
        + signal("FOOD_STYLE", "CAFE", "ONBOARDING", "1") + "]");
    var profile = provider().resolve(command("EXPLORE_RECOMMENDATION", null)).profile();
    assertThat(profile.dailyBudgetVnd()).isNull();
    assertThat(profile.preferredCategories()).contains("cafe");
    server.verify();
  }
  private final RestClient.Builder builder = RestClient.builder();
  // Any User call is unexpected: this server permits only the Context/trip calls below.
  private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
  private final RecommendationProperties properties = new RecommendationProperties();
  private final ObservedHistoryReader history = mock(ObservedHistoryReader.class);
  private final UUID userId = UUID.randomUUID();

  @Test
  void readsContextWithoutUserGateAndPreservesObservedSignalsAndRequestConstraints() {
    context("[" + signal("FOOD_STYLE", "CAFE", "ONBOARDING", "0.8") + "]");
    when(history.read(userId, null, "session", true)).thenReturn(observed());
    var result = provider().resolve(command("EXPLORE_RECOMMENDATION", null));
    assertThat(result.profile().preferredCategories()).containsExactly("cafe");
    assertThat(result.profile().categoryAffinities().get("cafe")).isCloseTo(0.9, within(0.00001));
    assertThat(result.profile().seenPlaceIds()).containsExactly("seen");
    assertThat(result.profile().savedPlaceIds()).containsExactly("saved");
    assertThat(result.profile().negativePlaceIds()).containsExactly("negative");
    assertThat(result.query()).isEqualTo("museum");
    assertThat(result.requiredCategories()).containsExactly("attraction");
    verify(history).read(userId, null, "session", true);
    server.verify();
  }

  @Test
  void disabledHistoryStillReadsContextAndNeverCallsHistoryReader() {
    properties.getProfile().setObservedHistoryEnabled(false);
    context("[" + signal("FOOD_STYLE", "CAFE", "ONBOARDING", "1") + "]");
    var profile = provider().resolve(command("EXPLORE_RECOMMENDATION", null)).profile();
    assertThat(profile.available()).isTrue();
    assertThat(profile.personalizationEnabled()).isTrue();
    assertThat(profile.categoryAffinities()).containsEntry("cafe", 1.0);
    verifyNoInteractions(history);
    server.verify();
  }

  @Test
  void historyFailureDoesNotDiscardDeclaredContext() {
    when(history.read(any(), any(), any(), anyBoolean()))
        .thenThrow(new IllegalStateException("secret"));
    context("[" + signal("FOOD_STYLE", "CAFE", "ONBOARDING", "1") + "]");
    assertThat(provider().resolve(command("EXPLORE_RECOMMENDATION", null)).profile().available())
        .isTrue();
    server.verify();
  }

  @Test
  void failureLogsNeverIncludeExceptionMessagesTokensOrUpstreamBody() {
    var logger =
        (ch.qos.logback.classic.Logger)
            org.slf4j.LoggerFactory.getLogger(RemoteRecommendationContextProvider.class);
    var appender =
        new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
    appender.start();
    logger.addAppender(appender);
    try {
      when(history.read(any(), any(), any(), anyBoolean()))
          .thenThrow(new IllegalStateException("private-db-details"));
      expectContext()
          .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR).body("private-upstream-body"));
      assertThat(provider().resolve(command("EXPLORE_RECOMMENDATION", null)).profile().available())
          .isFalse();
      String messages =
          appender.list.stream()
              .map(event -> event.getFormattedMessage())
              .collect(java.util.stream.Collectors.joining("\n"));
      assertThat(messages)
          .contains("observed_history_unavailable", "declared_preferences_unavailable")
          .doesNotContain("private-db-details", "private-upstream-body", "test-token", "museum");
      server.verify();
    } finally {
      logger.detachAppender(appender);
      appender.stop();
    }
  }

  @ParameterizedTest
  @ValueSource(ints = {401, 403, 500})
  void contextHttpFailureKeepsHistoryWithoutUserFallback(int status) {
    expectContext().andRespond(withStatus(HttpStatus.valueOf(status)));
    when(history.read(any(), any(), any(), anyBoolean())).thenReturn(observed());
    var profile = provider().resolve(command("EXPLORE_RECOMMENDATION", null)).profile();
    assertThat(profile.savedPlaceIds()).containsExactly("saved");
    assertThat(profile.preferredCategories()).isEmpty();
    server.verify();
  }

  @ParameterizedTest
  @ValueSource(strings = {"[]", "null", "{}", "{\"data\":[]}", "not-json", "[] {}", "[null]"})
  void emptyOrMalformedContextDoesNotClaimPersonalization(String json) {
    properties.getProfile().setObservedHistoryEnabled(false);
    context(json);
    var profile = provider().resolve(command("EXPLORE_RECOMMENDATION", null)).profile();
    assertThat(profile.available()).isFalse();
    assertThat(profile.personalizationEnabled()).isTrue();
    assertThat(profile.preferredCategories()).isEmpty();
    server.verify();
  }

  @Test
  void rejectsWrongSourcesDimensionsValuesAndInvalidConfidence() {
    properties.getProfile().setObservedHistoryEnabled(false);
    context(
        "["
            + String.join(
                ",",
                signal("FOOD_STYLE", "CAFE", "HISTORY", "1"),
                signal("LOYALTY_PROGRAM", "CAFE", "ONBOARDING", "1"),
                signal("FOOD_STYLE", "HOTEL", "ONBOARDING", "1"),
                signal("FOOD_STYLE", "CAFE", "ONBOARDING", "-1"),
                signal("FOOD_STYLE", "CAFE", "ONBOARDING", "2"),
                signal("FOOD_STYLE", "CAFE", "ONBOARDING", "\"1\""),
                signal("FOOD_STYLE", "CAFE", "ONBOARDING", "0"))
            + "]");
    assertThat(provider().resolve(command("EXPLORE_RECOMMENDATION", null)).profile().available())
        .isFalse();
    server.verify();
  }

  @Test
  void deduplicatesSignalsInsteadOfInflatingConfidenceAndAllowsExploreDerivedSignals() {
    properties.getProfile().setObservedHistoryEnabled(false);
    context(
        "["
            + String.join(
                ",",
                signal("FOOD_STYLE", "CAFE", "ONBOARDING", "0.8"),
                signal("FOOD_STYLE", "CAFE", "ONBOARDING", "0.8"),
                signal("EXPLORE_AFFINITY", "BEACH", "ONBOARDING_DERIVED_V1", "0.7"))
            + "]");
    var profile = provider().resolve(command("EXPLORE_RECOMMENDATION", null)).profile();
    assertThat(profile.categoryAffinities()).containsEntry("cafe", 0.8).containsEntry("beach", 0.7);
    server.verify();
  }

  @Test
  void planningUsesItsOwnPurposeAndRejectsExploreOnlyDerivedAffinity() {
    properties.getProfile().setObservedHistoryEnabled(false);
    server
        .expect(
            requestTo(
                properties.getDownstream().getContextUrl()
                    + "/api/context/preferences?purpose=TRIP_PLANNING"))
        .andExpect(header("Authorization", "Bearer test-token"))
        .andRespond(
            withSuccess(
                "[" + signal("EXPLORE_AFFINITY", "CAFE", "ONBOARDING_DERIVED_V1", "1") + "]",
                MediaType.APPLICATION_JSON));
    assertThat(provider().resolve(command("TRIP_PLANNING", null)).profile().available()).isFalse();
    server.verify();
  }

  @Test
  void oversizedPayloadFallsBackWithoutUnboundedBuffering() {
    properties.getProfile().setObservedHistoryEnabled(false);
    context("[" + signal("FOOD_STYLE", "CAFE", "ONBOARDING", "1") + "]" + " ".repeat(70_000));
    assertThat(provider().resolve(command("EXPLORE_RECOMMENDATION", null)).profile().available())
        .isFalse();
    server.verify();
  }

  @Test
  void excessiveSignalCountIsNotSilentlyTruncated() {
    properties.getProfile().setObservedHistoryEnabled(false);
    context(
        "["
            + String.join(
                ",",
                java.util.Collections.nCopies(201, signal("FOOD_STYLE", "CAFE", "ONBOARDING", "1")))
            + "]");
    assertThat(provider().resolve(command("EXPLORE_RECOMMENDATION", null)).profile().available())
        .isFalse();
    server.verify();
  }

  @Test
  void tripAuthorizationFailureStillFailsTheRequest() {
    properties.getProfile().setObservedHistoryEnabled(false);
    context("[]");
    UUID tripId = UUID.randomUUID();
    server
        .expect(requestTo(properties.getDownstream().getTripUrl() + "/api/trips/" + tripId))
        .andRespond(withStatus(HttpStatus.FORBIDDEN));
    assertThatThrownBy(() -> provider().resolve(command("EXPLORE_RECOMMENDATION", tripId)))
        .isInstanceOf(TripContextNotAccessibleException.class);
    server.verify();
  }

  private org.springframework.test.web.client.ResponseActions expectContext() {
    return server
        .expect(
            requestTo(
                properties.getDownstream().getContextUrl()
                    + "/api/context/preferences?purpose=EXPLORE_RECOMMENDATION"))
        .andExpect(header("Authorization", "Bearer test-token"));
  }

  private void context(String json) {
    expectContext().andRespond(withSuccess(json, MediaType.APPLICATION_JSON));
  }

  private RemoteRecommendationContextProvider provider() {
    return new RemoteRecommendationContextProvider(
        builder.build(), properties, history, new ExplorePreferenceMapper());
  }

  private RecommendationCommand command(String purpose, UUID tripId) {
    return new RecommendationCommand(
        userId,
        "test-token",
        "museum",
        tripId,
        "session",
        null,
        null,
        Set.of(),
        Set.of(),
        Set.of("attraction"),
        null,
        java.util.List.of(),
        48,
        purpose);
  }

  private static UserProfileSnapshot observed() {
    return new UserProfileSnapshot(
        true,
        true,
        Set.of(),
        Set.of(),
        Map.of("cafe", 0.5),
        Set.of("seen"),
        Set.of("saved"),
        Set.of("added"),
        Set.of("negative"),
        Instant.EPOCH);
  }

  private static String signal(String dimension, String value, String source, String confidence) {
    return "{\"dimensionCode\":\""
        + dimension
        + "\",\"valueCode\":\""
        + value
        + "\",\"source\":\""
        + source
        + "\",\"confidence\":"
        + confidence
        + "}";
  }
}
