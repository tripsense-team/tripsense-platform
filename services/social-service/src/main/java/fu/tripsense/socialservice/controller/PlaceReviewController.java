package fu.tripsense.socialservice.controller;

import fu.tripsense.socialservice.dto.request.PlaceReviewRequest;
import fu.tripsense.socialservice.dto.response.*;
import fu.tripsense.socialservice.security.CurrentUserProvider;
import fu.tripsense.socialservice.service.PlaceReviewService;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/social")
@RequiredArgsConstructor
public class PlaceReviewController {
  private final PlaceReviewService service;
  private final CurrentUserProvider currentUser;

  @GetMapping("/places/{placeRef}/reviews")
  public ApiResponse<PlaceReviewsResponse> list(
      @PathVariable String placeRef,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    UUID viewerId = currentUser.optionalUser().map(user -> user.id()).orElse(null);
    return ApiResponse.success(service.list(placeRef, viewerId, page, size));
  }

  @PostMapping("/places/{placeRef}/reviews")
  public ResponseEntity<ApiResponse<PlaceReviewItemResponse>> create(
      @PathVariable String placeRef, @Valid @RequestBody PlaceReviewRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(
            ApiResponse.success(
                "Review created",
                service.create(currentUser.requiredUser().id(), placeRef, request)));
  }

  @PatchMapping("/place-reviews/{reviewId}")
  public ApiResponse<PlaceReviewItemResponse> update(
      @PathVariable UUID reviewId, @Valid @RequestBody PlaceReviewRequest request) {
    return ApiResponse.success(
        "Review updated", service.update(currentUser.requiredUser().id(), reviewId, request));
  }

  @DeleteMapping("/place-reviews/{reviewId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID reviewId) {
    service.delete(currentUser.requiredUser().id(), reviewId);
  }
}
