package fu.tripsense.tripservice.partner.controller;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.partner.dto.InternalGuideSummaryBatchRequest;
import fu.tripsense.tripservice.partner.dto.InternalGuideSummaryResponse;
import fu.tripsense.tripservice.partner.service.GuidePromotionService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/partner-guide-summaries")
@RequiredArgsConstructor
public class InternalPartnerGuideController {

  private final GuidePromotionService promotionService;

  @PostMapping("/batch")
  public ResponseEntity<ApiResponse<List<InternalGuideSummaryResponse>>> getGuideSummariesBatch(
      @Valid @RequestBody InternalGuideSummaryBatchRequest request) {
    List<InternalGuideSummaryResponse> summaries =
        promotionService.getGuideSummariesBatch(request.promotionIds());
    return ResponseEntity.ok(ApiResponse.success(summaries));
  }
}
