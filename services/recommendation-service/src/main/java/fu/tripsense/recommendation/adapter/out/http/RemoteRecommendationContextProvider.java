package fu.tripsense.recommendation.adapter.out.http;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import fu.tripsense.recommendation.application.RecommendationCommand;
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
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

@Slf4j
@Component
public class RemoteRecommendationContextProvider implements RecommendationContextProvider {
  private static final Set<String> CATEGORY_DIMENSIONS =
      Set.of("FOOD_STYLE", "ACTIVITY_INTEREST", "STAY_STYLE", "SPLURGE_CATEGORY");

  private final RestClient restClient;
  private final RecommendationProperties.Downstream endpoints;
  private final ObservedHistoryReader historyReader;

  public RemoteRecommendationContextProvider(
      RestClient recommendationRestClient,
      RecommendationProperties properties,
      ObservedHistoryReader historyReader) {
    this.restClient = recommendationRestClient;
    this.endpoints = properties.getDownstream();
    this.historyReader = historyReader;
  }

  @Override
  public RecommendationContext resolve(RecommendationCommand command) {
    boolean enabled = personalizationEnabled(command.accessToken());
    UserProfileSnapshot observed = historyReader.read(command.userId(), enabled);
    UserProfileSnapshot profile =
        enabled ? mergeDeclared(observed, command.accessToken()) : observed;
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

  private boolean personalizationEnabled(String token) {
    try {
      UserEnvelope response =
          restClient
              .get()
              .uri(endpoints.getUserUrl() + "/api/users/me/travel-preferences")
              .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
              .retrieve()
              .body(UserEnvelope.class);
      return response != null
          && response.data() != null
          && response.data().personalizationEnabled();
    } catch (RuntimeException exception) {
      log.warn(
          "personalization_consent_unavailable errorType={}", exception.getClass().getSimpleName());
      return false;
    }
  }

  private UserProfileSnapshot mergeDeclared(UserProfileSnapshot observed, String token) {
    try {
      PreferenceSignal[] response =
          restClient
              .get()
              .uri(endpoints.getContextUrl() + "/api/context/preferences?purpose=TRIP_PLANNING")
              .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
              .retrieve()
              .body(PreferenceSignal[].class);
      Set<String> preferred = new HashSet<>(observed.preferredCategories());
      if (response != null) {
        for (PreferenceSignal signal : response) {
          if (CATEGORY_DIMENSIONS.contains(signal.dimensionCode()) && signal.valueCode() != null) {
            preferred.add(signal.valueCode().toLowerCase(Locale.ROOT));
          }
        }
      }
      return new UserProfileSnapshot(
          response != null || observed.available(),
          true,
          preferred,
          observed.dislikedCategories(),
          observed.categoryAffinities(),
          observed.seenPlaceIds(),
          observed.savedPlaceIds(),
          observed.addedToTripPlaceIds(),
          observed.negativePlaceIds(),
          Instant.now());
    } catch (RuntimeException exception) {
      log.warn(
          "declared_preferences_unavailable errorType={}", exception.getClass().getSimpleName());
      return observed;
    }
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

  @JsonIgnoreProperties(ignoreUnknown = true)
  record UserEnvelope(boolean success, UserPreference data) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record UserPreference(
      boolean personalizationEnabled,
      Map<String, Object> preferences,
      Instant consentedAt,
      Long version,
      Instant updatedAt) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record PreferenceSignal(
      String dimensionCode,
      String valueCode,
      double confidence,
      String source,
      Instant updatedAt) {}

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
