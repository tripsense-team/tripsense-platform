package fu.tripsense.recommendation.api;

import fu.tripsense.recommendation.api.dto.ApiResponse;
import fu.tripsense.recommendation.api.dto.PlaceIndexRequestItem;
import fu.tripsense.recommendation.api.dto.PlaceIndexResponse;
import fu.tripsense.recommendation.api.dto.PlaceIndexItemResult;
import fu.tripsense.recommendation.application.PlaceIndexingService;
import fu.tripsense.recommendation.security.InternalApiKeyAuthorizer;
import jakarta.validation.Valid;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recommendations/internal/places")
public class InternalPlaceIndexingController {
  private final PlaceIndexingService indexingService;
  private final InternalApiKeyAuthorizer authorizer;

  public InternalPlaceIndexingController(
      PlaceIndexingService indexingService, InternalApiKeyAuthorizer authorizer) {
    this.indexingService = indexingService;
    this.authorizer = authorizer;
  }

  @PostMapping("/index")
  public ApiResponse<PlaceIndexResponse> indexPlaces(
      @RequestHeader(value = "X-Internal-Api-Key", required = false) String apiKey,
      @RequestBody List<@Valid PlaceIndexRequestItem> items) {
    authorizer.requireAuthorized(apiKey);
    if (items == null || items.isEmpty()) {
      return ApiResponse.success(
          new PlaceIndexResponse(0, 0, 0, 0, 0, indexingService.isSemanticEnabled(), List.of()));
    }
    if (items.size() > 100) throw new IllegalArgumentException("Index batch exceeds limit");
    Instant maximumSourceTime = Instant.now().plus(Duration.ofMinutes(10));
    if (items.stream()
        .anyMatch(
            item ->
                item != null
                    && item.sourceUpdatedAt() != null
                    && item.sourceUpdatedAt().isAfter(maximumSourceTime))) {
      throw new IllegalArgumentException("Source update time is too far in the future");
    }
    var submissions =
        items.stream()
            .map(
                item ->
                    new fu.tripsense.recommendation.application.PlaceIndexSubmission(
                        item.toDomain(), item.sourceVersion(), item.sourceUpdatedAt()))
            .toList();
    var outcome = indexingService.indexSubmissions(submissions);
    return ApiResponse.success(
        new PlaceIndexResponse(
            outcome.submitted(),
            outcome.indexed(),
            outcome.skipped(),
            outcome.unchanged(),
            outcome.failed(),
            indexingService.isSemanticEnabled(),
            outcome.results().stream()
                .map(
                    result ->
                        new PlaceIndexItemResult(
                            result.placeId(),
                            result.sourceVersion(),
                            PlaceIndexItemResult.Status.valueOf(result.status().name()),
                            result.errorCode()))
                .toList()));
  }

  @DeleteMapping("/{placeId}")
  public ResponseEntity<Void> removePlace(
      @RequestHeader(value = "X-Internal-Api-Key", required = false) String apiKey,
      @PathVariable String placeId) {
    authorizer.requireAuthorized(apiKey);
    indexingService.removePlace(placeId);
    return ResponseEntity.noContent().build();
  }
}
