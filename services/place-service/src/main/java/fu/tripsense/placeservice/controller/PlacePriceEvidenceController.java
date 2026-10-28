package fu.tripsense.placeservice.controller;

import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PriceEvidence;
import fu.tripsense.placeservice.dto.ApiResponse;
import fu.tripsense.placeservice.exception.PlaceActionException;
import fu.tripsense.placeservice.service.PlaceCacheService;
import java.time.Instant;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Protected by /api/places/admin/** ADMIN matcher in Place SecurityConfig. */
@RestController
@RequestMapping("/api/places/admin/{placeId}/price-evidence")
public class PlacePriceEvidenceController {
  private final MongoTemplate mongo;
  private final PlaceCacheService cache;

  public PlacePriceEvidenceController(MongoTemplate mongo, PlaceCacheService cache) {
    this.mongo = mongo;
    this.cache = cache;
  }

  @PutMapping
  public ApiResponse<PriceEvidence> put(@PathVariable String placeId,
      @RequestBody PriceEvidenceRequest request, Authentication authentication) {
    PriceEvidence evidence;
    try {
      evidence = new PriceEvidence(request.amountVnd().longValueExact(), request.basis(),
          request.sourceUrl(), request.observedAt());
    } catch (RuntimeException invalid) {
      throw new IllegalArgumentException("Price must be whole VND");
    }
    if (evidence == null || !evidence.validAt(Instant.now())) {
      throw new IllegalArgumentException("Invalid sourced per-person VND price evidence");
    }
    update(placeId, new Update().set("priceEvidence", evidence), authentication);
    return ApiResponse.ok(evidence);
  }

  public record PriceEvidenceRequest(java.math.BigDecimal amountVnd, String basis,
      String sourceUrl, Instant observedAt) {}

  @DeleteMapping
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable String placeId, Authentication authentication) {
    update(placeId, new Update().unset("priceEvidence"), authentication);
  }

  private void update(String placeId, Update update, Authentication authentication) {
    update.set("priceEvidenceEditedAt", Instant.now())
        .set("priceEvidenceEditedBy", authentication.getName());
    var result = mongo.updateFirst(Query.query(Criteria.where("_id").is(placeId)), update, Place.class);
    if (result.getMatchedCount() == 0) {
      throw new PlaceActionException(HttpStatus.NOT_FOUND, "PLACE_NOT_FOUND", "Place not found");
    }
    cache.invalidatePriceEvidence(placeId);
  }
}
