package fu.tripsense.recommendation.api;

import fu.tripsense.recommendation.api.dto.ApiResponse;
import fu.tripsense.recommendation.api.dto.PlaceIndexRequestItem;
import fu.tripsense.recommendation.api.dto.PlaceIndexResponse;
import fu.tripsense.recommendation.application.PlaceIndexingService;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import fu.tripsense.recommendation.security.InternalApiKeyAuthorizer;
import java.util.List;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recommendations/internal/places")
public class InternalPlaceIndexingController {
  private final PlaceIndexingService indexingService;
  private final InternalApiKeyAuthorizer authorizer;
  private final RecommendationProperties properties;

  public InternalPlaceIndexingController(
      PlaceIndexingService indexingService,
      InternalApiKeyAuthorizer authorizer,
      RecommendationProperties properties) {
    this.indexingService = indexingService;
    this.authorizer = authorizer;
    this.properties = properties;
  }

  @PostMapping("/index")
  public ApiResponse<PlaceIndexResponse> indexPlaces(
      @RequestHeader(value = "X-Internal-Api-Key", required = false) String apiKey,
      @RequestHeader(value = "X-Gemini-Api-Key", required = false) String geminiApiKey,
      @RequestBody List<@Valid PlaceIndexRequestItem> items) {
    authorizer.requireAuthorized(apiKey);
    if (geminiApiKey != null && !geminiApiKey.isBlank()) {
      properties.getSemantic().setEmbeddingApiKey(geminiApiKey.trim());
    }
    if (items == null || items.isEmpty()) {
      return ApiResponse.success(new PlaceIndexResponse(0, 0, 0, indexingService.isSemanticEnabled()));
    }
    List<PlaceSnapshot> snapshots = items.stream().map(PlaceIndexRequestItem::toDomain).toList();
    var outcome = indexingService.indexPlaces(snapshots);
    return ApiResponse.success(
        new PlaceIndexResponse(
            outcome.submitted(), outcome.indexed(), outcome.skipped(), indexingService.isSemanticEnabled()));
  }
}
