package fu.tripsense.recommendation.adapter.out.http;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.application.ObservedTiming;
import fu.tripsense.recommendation.application.RecommendationCommand;
import fu.tripsense.recommendation.application.RequestDiagnostics;
import fu.tripsense.recommendation.application.TripContextNotAccessibleException;
import fu.tripsense.recommendation.application.TripContextUnavailableException;
import fu.tripsense.recommendation.application.port.ObservedHistoryReader;
import fu.tripsense.recommendation.application.port.RecommendationContextProvider;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.RecommendationContext;
import fu.tripsense.recommendation.domain.TripContextSnapshot;
import fu.tripsense.recommendation.domain.UserProfileSnapshot;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

@Slf4j
@Component
public class RemoteRecommendationContextProvider implements RecommendationContextProvider {
  // Eight catalog dimensions x max 20 selections, plus six derived Explore affinities.
  private static final int MAX_SIGNALS = 200;
  private static final int MAX_CONTEXT_BYTES = 65_536;
  private static final ObjectMapper CONTEXT_JSON =
      new ObjectMapper().enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
  private final RestClient restClient;
  private final RecommendationProperties.Downstream endpoints;
  private final ObservedHistoryReader historyReader;
  private final ExplorePreferenceMapper preferenceMapper;
  private final RecommendationProperties.Profile profileSettings;

  public RemoteRecommendationContextProvider(
      RestClient recommendationRestClient,
      RecommendationProperties properties,
      ObservedHistoryReader historyReader,
      ExplorePreferenceMapper preferenceMapper) {
    this.restClient = recommendationRestClient;
    this.endpoints = properties.getDownstream();
    this.historyReader = historyReader;
    this.preferenceMapper = preferenceMapper;
    this.profileSettings = properties.getProfile();
  }

  @Override
  public RecommendationContext resolve(RecommendationCommand command) {
    UserProfileSnapshot observed = readObserved(command);
    UserProfileSnapshot profile =
        mergeDeclared(observed, command.accessToken(), command.preferencePurpose());
    RequestDiagnostics.mark("personalization_enabled", profile.personalizationEnabled());
    TripContextSnapshot trip =
        command.tripId() == null ? null : getTrip(command.tripId(), command.accessToken());
    String query = resolveQuery(command, trip);
    return new RecommendationContext(
        UUID.randomUUID(),
        command.userId(),
        command.tripId(),
        command.sessionId(),
        query,
        command.anchor(),
        command.radiusMeters(),
        command.preferredCategories(),
        command.dislikedCategories(),
        command.requiredCategories(),
        command.geographicScope(),
        command.rankingCriteria(),
        profile,
        trip,
        command.limit());
  }

  private String resolveQuery(RecommendationCommand command, TripContextSnapshot trip) {
    if (command.query() != null && !command.query().isBlank()) return command.query().trim();
    if (command.preferredCategories() != null && !command.preferredCategories().isEmpty()) {
      return command.preferredCategories().iterator().next();
    }
    if (trip != null && trip.destinationName() != null && !trip.destinationName().isBlank()) {
      return "địa điểm nổi tiếng ở " + trip.destinationName();
    }
    if (command.anchor() != null) return "địa điểm nổi tiếng";
    throw new IllegalArgumentException("A query, category, trip, or location anchor is required");
  }

  private UserProfileSnapshot readObserved(RecommendationCommand command) {
    RequestDiagnostics.mark("observed_history_enabled", profileSettings.isObservedHistoryEnabled());
    if (!profileSettings.isObservedHistoryEnabled()) {
      RequestDiagnostics.mark("observed_history_status", "disabled");
      return UserProfileSnapshot.coldStart(true);
    }
    try {
      UserProfileSnapshot observed =
          RequestDiagnostics.measure(
              "observed_history",
              () ->
                  ObservedTiming.measure(
                      () ->
                          historyReader.read(
                              command.userId(), command.tripId(), command.sessionId(), true)));
      if (observed == null) throw new IllegalStateException("Missing observed snapshot");
      RequestDiagnostics.mark(
          "observed_history_status", observed.available() ? "available" : "empty");
      return observed;
    } catch (RuntimeException exception) {
      RequestDiagnostics.mark("observed_history_status", "unavailable");
      log.warn("observed_history_unavailable errorType={}", exception.getClass().getSimpleName());
      return UserProfileSnapshot.coldStart(true);
    }
  }

  private UserProfileSnapshot mergeDeclared(
      UserProfileSnapshot observed, String token, String purpose) {
    try {
      Map<String, PreferenceSignal> response =
          RequestDiagnostics.measure(
              "context_preferences",
              () ->
                  restClient
                      .get()
                      .uri(
                          endpoints.getContextUrl() + "/api/context/preferences?purpose={purpose}",
                          purpose)
                      .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                      .exchange(
                          (request, reply) -> {
                            if (!reply.getStatusCode().is2xxSuccessful()) {
                              throw new IllegalStateException("Context unavailable");
                            }
                            byte[] bytes = reply.getBody().readNBytes(MAX_CONTEXT_BYTES + 1);
                            if (bytes.length > MAX_CONTEXT_BYTES) {
                              throw new IllegalStateException("Context payload exceeds limit");
                            }
                            return parseSignals(CONTEXT_JSON.readTree(bytes), purpose);
                          }));
      Set<String> preferred = new HashSet<>(observed.preferredCategories());
      Map<String, Double> affinities = new java.util.HashMap<>(observed.categoryAffinities());
      int mappedSignals = 0;
      for (PreferenceSignal signal : response.values()) {
        var mapped =
            preferenceMapper.map(signal.dimensionCode(), signal.valueCode(), signal.confidence());
        if (!mapped.isEmpty()) mappedSignals++;
        mapped.forEach(
            (category, confidence) -> {
              preferred.add(category);
              affinities.merge(
                  category,
                  confidence,
                  (current, incoming) -> 1 - ((1 - Math.max(0, current)) * (1 - incoming)));
            });
      }
      RequestDiagnostics.mark(
          "context_preferences_status", mappedSignals > 0 ? "available" : "empty");
      RequestDiagnostics.mark("context_preference_signals", mappedSignals);
      return new UserProfileSnapshot(
          mappedSignals > 0 || dailyBudget(response.values()) != null || observed.available(),
          true,
          preferred,
          observed.dislikedCategories(),
          affinities,
          observed.seenPlaceIds(),
          observed.savedPlaceIds(),
          observed.addedToTripPlaceIds(),
          observed.negativePlaceIds(),
          Instant.now(),
          dailyBudget(response.values()),
          response.values().stream().filter(s -> "BUDGET_TIER".equals(s.dimensionCode()))
              .map(PreferenceSignal::valueCode).sorted().findFirst().orElse(null));
    } catch (RuntimeException exception) {
      RequestDiagnostics.mark("context_preferences_status", "unavailable");
      RequestDiagnostics.mark("context_preference_signals", 0);
      log.warn(
          "declared_preferences_unavailable errorType={}", exception.getClass().getSimpleName());
      return observed;
    }
  }

  private static Map<String, PreferenceSignal> parseSignals(JsonNode root, String purpose) {
    if (root == null || !root.isArray() || root.size() > MAX_SIGNALS) {
      throw new IllegalStateException("Invalid Context signal array");
    }
    Map<String, PreferenceSignal> result = new TreeMap<>();
    for (JsonNode node : root) {
      if (!node.isObject()) throw new IllegalStateException("Invalid Context signal");
      JsonNode dimension = node.path("dimensionCode");
      JsonNode value = node.path("valueCode");
      JsonNode source = node.path("source");
      JsonNode confidence = node.path("confidence");
      if (!dimension.isTextual()
          || !value.isTextual()
          || !source.isTextual()
          || !confidence.isNumber()) continue;
      double weight = confidence.doubleValue();
      if (!Double.isFinite(weight) || weight <= 0 || weight > 1) continue;
      String dim = dimension.textValue();
      boolean derived = "EXPLORE_AFFINITY".equals(dim);
      if (derived
          ? !"EXPLORE_RECOMMENDATION".equals(purpose)
              || !"ONBOARDING_DERIVED_V1".equals(source.textValue())
          : !"ONBOARDING".equals(source.textValue())) continue;
      if (dim.length() > 80 || value.textValue().length() > 128) continue;
      PreferenceSignal signal = new PreferenceSignal(dim, value.textValue(), weight);
      result.merge(
          dim + ":" + value.textValue(),
          signal,
          (left, right) -> left.confidence() >= right.confidence() ? left : right);
    }
    return result;
  }

  private static Long dailyBudget(java.util.Collection<PreferenceSignal> signals) {
    var amounts = signals.stream().filter(s -> "DAILY_BUDGET_VND".equals(s.dimensionCode()))
        .map(PreferenceSignal::valueCode).distinct().toList();
    if (amounts.size() != 1) return null;
    String value = amounts.getFirst();
    if (!value.matches("[1-9][0-9]{0,9}")) return null;
    long amount = Long.parseLong(value);
    return amount <= 1_000_000_000L ? amount : null;
  }

  private TripContextSnapshot getTrip(UUID tripId, String token) {
    try {
      TripEnvelope response =
          restClient
              .get()
              .uri(endpoints.getTripUrl() + "/api/trips/{tripId}", tripId)
              .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
              .retrieve()
              .body(TripEnvelope.class);
      if (response == null || response.data() == null) {
        throw new TripContextNotAccessibleException(
            new IllegalArgumentException("Trip response contained no accessible data"));
      }
      TripDto value = response.data();
      return new TripContextSnapshot(
          value.id(),
          value.destinationName(),
          value.destinationPlaceRef(),
          value.startDate(),
          value.endDate(),
          value.travelerCount(),
          value.budgetCurrency());
    } catch (HttpClientErrorException exception) {
      // Do not reveal whether a trip exists when the caller cannot access it.
      throw new TripContextNotAccessibleException(exception);
    } catch (RuntimeException exception) {
      throw new TripContextUnavailableException(exception);
    }
  }

  record PreferenceSignal(String dimensionCode, String valueCode, double confidence) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record TripEnvelope(boolean success, TripDto data) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record TripDto(
      UUID id,
      String destinationName,
      String destinationPlaceRef,
      LocalDate startDate,
      LocalDate endDate,
      Integer travelerCount,
      String budgetCurrency) {}
}
