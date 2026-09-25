package fu.tripsense.recommendation.api;

import fu.tripsense.recommendation.api.dto.ApiResponse;
import fu.tripsense.recommendation.api.dto.FeedbackRequest;
import fu.tripsense.recommendation.api.dto.RecommendationRequest;
import fu.tripsense.recommendation.api.dto.RecommendationResponse;
import fu.tripsense.recommendation.application.FeedbackCommand;
import fu.tripsense.recommendation.application.FeedbackService;
import fu.tripsense.recommendation.application.PersonalizationDataService;
import fu.tripsense.recommendation.application.RecommendationApplicationService;
import fu.tripsense.recommendation.application.RecommendationCommand;
import fu.tripsense.recommendation.domain.GeoPoint;
import fu.tripsense.recommendation.domain.GeographicScope;
import fu.tripsense.recommendation.domain.RankingCriterion;
import fu.tripsense.recommendation.security.CurrentUserProvider;
import jakarta.validation.Valid;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {
  private final RecommendationApplicationService recommendations;
  private final FeedbackService feedback;
  private final PersonalizationDataService personalizationData;
  private final CurrentUserProvider currentUser;

  public RecommendationController(
      RecommendationApplicationService recommendations,
      FeedbackService feedback,
      PersonalizationDataService personalizationData,
      CurrentUserProvider currentUser) {
    this.recommendations = recommendations;
    this.feedback = feedback;
    this.personalizationData = personalizationData;
    this.currentUser = currentUser;
  }

  @DeleteMapping("/personalization-data")
  public ResponseEntity<Void> erasePersonalizationData() {
    personalizationData.erase(currentUser.user().id());
    return ResponseEntity.noContent().build();
  }

  @PostMapping
  public ApiResponse<RecommendationResponse> recommend(
      @Valid @RequestBody RecommendationRequest request) {
    RecommendationCommand command =
        new RecommendationCommand(
            currentUser.user().id(),
            currentUser.accessToken(),
            request.query(),
            request.tripId(),
            request.sessionId(),
            request.lat() == null ? null : new GeoPoint(request.lat(), request.lng()),
            request.radiusMeters(),
            normalize(request.preferredCategories()),
            normalize(request.dislikedCategories()),
            normalize(request.requiredCategories()),
            request.geographicScope() == null
                ? null
                : new GeographicScope(
                    request.geographicScope().name(),
                    request.geographicScope().adminArea(),
                    request.geographicScope().district(),
                    request.geographicScope().strictNamedArea()),
            request.rankingCriteria() == null
                ? java.util.List.of()
                : request.rankingCriteria().stream()
                    .map(
                        value ->
                            new RankingCriterion(
                                RankingCriterion.Feature.valueOf(value.feature().name()),
                                RankingCriterion.Direction.valueOf(value.direction().name()),
                                RankingCriterion.Importance.valueOf(value.importance().name())))
                    .toList(),
            request.effectiveLimit());
    return ApiResponse.success(RecommendationResponse.from(recommendations.recommend(command)));
  }

  @PostMapping("/{recommendationId}/events")
  public ResponseEntity<ApiResponse<Void>> feedback(
      @PathVariable UUID recommendationId,
      @RequestHeader("Idempotency-Key") UUID idempotencyKey,
      @Valid @RequestBody FeedbackRequest request) {
    feedback.record(
        new FeedbackCommand(
            recommendationId,
            currentUser.user().id(),
            idempotencyKey,
            request.placeId(),
            request.eventType(),
            request.position(),
            request.occurredAt()));
    return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.success(null));
  }

  private Set<String> normalize(Set<String> values) {
    return values == null
        ? Set.of()
        : values.stream()
            .map(String::trim)
            .filter(value -> !value.isBlank())
            .map(value -> value.toLowerCase(Locale.ROOT))
            .collect(Collectors.toUnmodifiableSet());
  }
}
