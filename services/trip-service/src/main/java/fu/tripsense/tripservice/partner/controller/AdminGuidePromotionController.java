package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.GuidePromotionRevisionDecisionRequest;
import fu.tripsense.tripservice.partner.dto.GuidePromotionRevisionDto;
import fu.tripsense.tripservice.partner.enums.ApplicationState;
import fu.tripsense.tripservice.partner.service.GuidePromotionService;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/guide-promotion-revisions")
@RequiredArgsConstructor
public class AdminGuidePromotionController {

  private final GuidePromotionService promotionService;
  private final CurrentUserProvider currentUserProvider;

  @GetMapping
  public ResponseEntity<ApiResponse<List<GuidePromotionRevisionDto>>> listRevisions(
      @RequestParam(required = false) ApplicationState state,
      @RequestParam(required = false) String cursor) {
    fu.tripsense.tripservice.security.AuthenticatedUser admin = currentUserProvider.get();
    if (admin == null || !admin.isAdmin()) {
      throw new fu.tripsense.tripservice.exception.TripServiceException(
          "FORBIDDEN", "Admin permissions required", org.springframework.http.HttpStatus.FORBIDDEN);
    }
    List<GuidePromotionRevisionDto> list = promotionService.listAdminRevisions(state, cursor);
    return ResponseEntity.ok(ApiResponse.success(list));
  }

  @PostMapping("/{revisionId}/decision")
  public ResponseEntity<ApiResponse<GuidePromotionRevisionDto>> reviewDecision(
      @PathVariable UUID revisionId,
      @Valid @RequestBody GuidePromotionRevisionDecisionRequest request) {
    GuidePromotionRevisionDto dto =
        promotionService.reviewDecision(currentUserProvider.get(), revisionId, request);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }
}
