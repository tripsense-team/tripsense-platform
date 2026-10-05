package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.service.GuidePromotionService;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class GuidePromotionController {

  private final GuidePromotionService promotionService;
  private final CurrentUserProvider currentUserProvider;

  @GetMapping("/api/partners/businesses/{businessId}/guide-promotions")
  public ResponseEntity<ApiResponse<List<GuidePromotionDto>>> listPromotions(
      @PathVariable UUID businessId) {
    List<GuidePromotionDto> list =
        promotionService.listPromotions(currentUserProvider.get(), businessId);
    return ResponseEntity.ok(ApiResponse.success(list));
  }

  @PostMapping("/api/partners/businesses/{businessId}/guide-promotions")
  public ResponseEntity<ApiResponse<GuidePromotionDto>> createDraft(
      @PathVariable UUID businessId, @Valid @RequestBody CreateGuidePromotionDraftRequest request) {
    GuidePromotionDto created =
        promotionService.createDraft(currentUserProvider.get(), businessId, request);
    return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(created));
  }

  @GetMapping("/api/partners/businesses/{businessId}/guide-promotions/{promotionId}")
  public ResponseEntity<ApiResponse<GuidePromotionDto>> getPromotion(
      @PathVariable UUID businessId, @PathVariable UUID promotionId) {
    GuidePromotionDto dto =
        promotionService.getPromotion(currentUserProvider.get(), businessId, promotionId);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }

  @PatchMapping("/api/partners/businesses/{businessId}/guide-promotions/{promotionId}")
  public ResponseEntity<ApiResponse<GuidePromotionDto>> updateDraft(
      @PathVariable UUID businessId,
      @PathVariable UUID promotionId,
      @Valid @RequestBody UpdateGuidePromotionDraftRequest request) {
    GuidePromotionDto updated =
        promotionService.updateDraft(currentUserProvider.get(), businessId, promotionId, request);
    return ResponseEntity.ok(ApiResponse.success(updated));
  }

  @PostMapping("/api/partners/businesses/{businessId}/guide-promotions/{promotionId}/submit")
  public ResponseEntity<ApiResponse<GuidePromotionDto>> submit(
      @PathVariable UUID businessId,
      @PathVariable UUID promotionId,
      @Valid @RequestBody SubmitGuidePromotionRequest request) {
    GuidePromotionDto submitted =
        promotionService.submit(currentUserProvider.get(), businessId, promotionId, request);
    return ResponseEntity.ok(ApiResponse.success(submitted));
  }

  @PostMapping("/api/partners/businesses/{businessId}/guide-promotions/{promotionId}/withdraw")
  public ResponseEntity<ApiResponse<GuidePromotionDto>> withdraw(
      @PathVariable UUID businessId,
      @PathVariable UUID promotionId,
      @Valid @RequestBody SubmitGuidePromotionRequest request) {
    GuidePromotionDto withdrawn =
        promotionService.withdraw(currentUserProvider.get(), businessId, promotionId, request);
    return ResponseEntity.ok(ApiResponse.success(withdrawn));
  }

  @PutMapping("/api/partners/businesses/{businessId}/guide-promotions/{promotionId}/publication")
  public ResponseEntity<ApiResponse<GuidePromotionDto>> updatePublication(
      @PathVariable UUID businessId,
      @PathVariable UUID promotionId,
      @Valid @RequestBody GuidePromotionPublicationRequest request) {
    GuidePromotionDto updated =
        promotionService.updatePublication(currentUserProvider.get(), businessId, promotionId, request);
    return ResponseEntity.ok(ApiResponse.success(updated));
  }

  @PutMapping("/api/partners/businesses/{businessId}/guide-promotions/{promotionId}/community-publication")
  public ResponseEntity<ApiResponse<CommunityPublicationDto>> updateCommunityPublication(
      @PathVariable UUID businessId,
      @PathVariable UUID promotionId,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
      @Valid @RequestBody CommunityPublicationRequest request) {
    CommunityPublicationDto dto =
        promotionService.updateCommunityPublication(
            currentUserProvider.get(), businessId, promotionId, request, idempotencyKey);
    return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.success(dto));
  }

  @GetMapping("/api/partners/businesses/{businessId}/guide-promotions/{promotionId}/community-publication")
  public ResponseEntity<ApiResponse<CommunityPublicationDto>> getCommunityPublication(
      @PathVariable UUID businessId,
      @PathVariable UUID promotionId) {
    CommunityPublicationDto dto =
        promotionService.getCommunityPublication(
            currentUserProvider.get(), businessId, promotionId);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }

  @PostMapping("/api/partners/businesses/{businessId}/promotion-media/upload-intents")
  public ResponseEntity<ApiResponse<PromotionMediaUploadIntentDto>> createMediaUploadIntent(
      @PathVariable UUID businessId,
      @Valid @RequestBody PromotionMediaUploadIntentRequest request) {
    PromotionMediaUploadIntentDto dto =
        promotionService.createMediaUploadIntent(currentUserProvider.get(), businessId, request);
    return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
  }

  @PostMapping("/api/partners/businesses/{businessId}/promotion-media/{mediaId}/complete")
  public ResponseEntity<ApiResponse<Void>> completeMediaUpload(
      @PathVariable UUID businessId, @PathVariable UUID mediaId) {
    promotionService.completeMediaUpload(currentUserProvider.get(), businessId, mediaId);
    return ResponseEntity.ok(ApiResponse.success(null));
  }

  @GetMapping("/api/guide-promotions")
  public ResponseEntity<ApiResponse<List<GuidePromotionSummaryDto>>> searchPublicPromotions(
      @RequestParam(required = false) String areaId,
      @RequestParam(required = false) List<String> topicIds,
      @RequestParam(required = false) List<String> skillIds,
      @RequestParam(required = false) String language,
      @RequestParam(required = false) String cursor) {
    List<GuidePromotionSummaryDto> list =
        promotionService.searchPublicPromotions(areaId, topicIds, skillIds, language, cursor);
    return ResponseEntity.ok(ApiResponse.success(list));
  }

  @GetMapping("/api/guide-promotions/{promotionId}")
  public ResponseEntity<ApiResponse<GuidePromotionSummaryDto>> getPublicPromotion(
      @PathVariable UUID promotionId) {
    GuidePromotionSummaryDto dto = promotionService.getPublicPromotion(promotionId);
    return ResponseEntity.ok(ApiResponse.success(dto));
  }
}
