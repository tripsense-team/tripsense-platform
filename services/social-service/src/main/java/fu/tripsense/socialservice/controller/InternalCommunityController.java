package fu.tripsense.socialservice.controller;

import fu.tripsense.socialservice.dto.request.CommunityGuidePromotionStatusBatchRequest;
import fu.tripsense.socialservice.dto.request.CommunityGuidePromotionSyncRequest;
import fu.tripsense.socialservice.dto.response.CommunityGuidePromotionAck;
import fu.tripsense.socialservice.dto.response.CommunityGuidePromotionStatusItem;
import fu.tripsense.socialservice.service.CommunityGuideDistributionService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/internal/community")
@RequiredArgsConstructor
public class InternalCommunityController {

  private final CommunityGuideDistributionService distributionService;

  @PutMapping("/guide-promotions/{promotionId}")
  public ResponseEntity<CommunityGuidePromotionAck> syncGuidePromotion(
      @PathVariable UUID promotionId,
      @Valid @RequestBody CommunityGuidePromotionSyncRequest request) {
    CommunityGuidePromotionAck ack = distributionService.syncGuidePromotion(promotionId, request);
    return ResponseEntity.ok(ack);
  }

  @PostMapping("/guide-promotions/status-batch")
  public ResponseEntity<List<CommunityGuidePromotionStatusItem>> getStatusBatch(
      @Valid @RequestBody CommunityGuidePromotionStatusBatchRequest request) {
    List<CommunityGuidePromotionStatusItem> items =
        distributionService.getStatusBatch(request.promotionIds());
    return ResponseEntity.ok(items);
  }
}
