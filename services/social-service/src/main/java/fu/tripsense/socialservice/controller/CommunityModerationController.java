package fu.tripsense.socialservice.controller;

import fu.tripsense.socialservice.dto.request.ModerationDecisionRequest;
import fu.tripsense.socialservice.dto.request.SubmitReportRequest;
import fu.tripsense.socialservice.dto.response.ApiResponse;
import fu.tripsense.socialservice.dto.response.ModerationReportPageResponse;
import fu.tripsense.socialservice.dto.response.ModerationReportResponse;
import fu.tripsense.socialservice.dto.response.ReportReceiptResponse;
import fu.tripsense.socialservice.security.CurrentUserProvider;
import fu.tripsense.socialservice.service.CommunityModerationService;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/social")
@RequiredArgsConstructor
public class CommunityModerationController {
  private final CommunityModerationService service;
  private final CurrentUserProvider currentUser;

  @PostMapping("/posts/{postId}/reports")
  public ApiResponse<ReportReceiptResponse> reportPost(
      @PathVariable UUID postId, @Valid @RequestBody SubmitReportRequest request) {
    return ApiResponse.success(
        "Report submitted", service.reportPost(postId, currentUser.requiredUser(), request));
  }

  @PostMapping("/posts/{postId}/comments/{commentId}/reports")
  public ApiResponse<ReportReceiptResponse> reportComment(
      @PathVariable UUID postId,
      @PathVariable UUID commentId,
      @Valid @RequestBody SubmitReportRequest request) {
    return ApiResponse.success(
        "Report submitted",
        service.reportComment(postId, commentId, currentUser.requiredUser(), request));
  }

  @GetMapping("/moderation/reports")
  public ApiResponse<ModerationReportPageResponse> listReports(
      @RequestParam(defaultValue = "PENDING") String status,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ApiResponse.success(service.listReports(status, page, size, currentUser.requiredUser()));
  }

  @PostMapping("/moderation/reports/{reportId}/decision")
  public ApiResponse<ModerationReportResponse> decide(
      @PathVariable UUID reportId, @Valid @RequestBody ModerationDecisionRequest request) {
    return ApiResponse.success(
        "Moderation decision recorded",
        service.decide(reportId, currentUser.requiredUser(), request));
  }
}
