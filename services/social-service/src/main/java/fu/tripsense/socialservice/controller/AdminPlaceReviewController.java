package fu.tripsense.socialservice.controller;

import fu.tripsense.socialservice.dto.request.UpdateAdminPlaceReviewStatusRequest;
import fu.tripsense.socialservice.dto.response.AdminPlaceReviewPageResponse;
import fu.tripsense.socialservice.dto.response.AdminPlaceReviewStatusResponse;
import fu.tripsense.socialservice.dto.response.ApiResponse;
import fu.tripsense.socialservice.security.CurrentUserProvider;
import fu.tripsense.socialservice.service.AdminPlaceReviewService;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/social/admin/reviews")
@RequiredArgsConstructor
public class AdminPlaceReviewController {

  private final AdminPlaceReviewService adminReviewService;
  private final CurrentUserProvider currentUser;

  @GetMapping
  public ApiResponse<AdminPlaceReviewPageResponse> listReviews(
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(required = false) String search,
      @RequestParam(defaultValue = "ALL") String status,
      @RequestParam(required = false) Integer rating) {
    return ApiResponse.success(
        adminReviewService.listReviews(
            currentUser.requiredUser(), page, size, search, status, rating));
  }

  @PatchMapping("/{reviewId}/status")
  public ApiResponse<AdminPlaceReviewStatusResponse> updateReviewStatus(
      @PathVariable UUID reviewId,
      @Valid @RequestBody UpdateAdminPlaceReviewStatusRequest request) {
    return ApiResponse.success(
        "Review status updated",
        adminReviewService.updateReviewStatus(currentUser.requiredUser(), reviewId, request));
  }
}

