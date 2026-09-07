package fu.tripsense.socialservice.controller;

import fu.tripsense.socialservice.dto.request.CreateCommentRequest;
import fu.tripsense.socialservice.dto.request.CreatePostRequest;
import fu.tripsense.socialservice.dto.request.UpdatePostContentRequest;
import fu.tripsense.socialservice.dto.request.UploadSignatureRequest;
import fu.tripsense.socialservice.dto.response.ApiResponse;
import fu.tripsense.socialservice.dto.response.PostCommentResponse;
import fu.tripsense.socialservice.dto.response.SocialPostPageResponse;
import fu.tripsense.socialservice.dto.response.SocialPostResponse;
import fu.tripsense.socialservice.dto.response.ToggleLikeResponse;
import fu.tripsense.socialservice.dto.response.UploadSignatureResponse;
import fu.tripsense.socialservice.security.CurrentUserProvider;
import fu.tripsense.socialservice.service.SocialPostService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/social")
@RequiredArgsConstructor
public class SocialPostController {

    private final SocialPostService service;
    private final CurrentUserProvider currentUser;

    @GetMapping("/posts")
    public ApiResponse<SocialPostPageResponse> listPosts(
            @RequestParam(required = false) UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return ApiResponse.success(service.listPosts(userId, page, size, currentUser.optionalUser().orElse(null)));
    }

    @GetMapping("/posts/{postId}")
    public ApiResponse<SocialPostResponse> getPost(@PathVariable UUID postId) {
        return ApiResponse.success(service.getPost(postId, currentUser.optionalUser().orElse(null)));
    }

    @PostMapping("/posts")
    public ResponseEntity<ApiResponse<SocialPostResponse>> createPost(
            @RequestHeader("Idempotency-Key") UUID idempotencyKey,
            @Valid @RequestBody CreatePostRequest request
    ) {
        SocialPostResponse created = service.createPost(currentUser.requiredUser(), request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Post created", created));
    }

    @PatchMapping("/posts/{postId}")
    public ApiResponse<SocialPostResponse> updatePostContent(
            @PathVariable UUID postId,
            @Valid @RequestBody UpdatePostContentRequest request
    ) {
        SocialPostResponse updated = service.updateContent(postId, currentUser.requiredUser(), request);
        return ApiResponse.success("Post updated", updated);
    }

    @PostMapping("/trip-shares")
    public ResponseEntity<ApiResponse<SocialPostResponse>> createTripShare(
            @RequestHeader("Idempotency-Key") UUID idempotencyKey,
            @Valid @RequestBody fu.tripsense.socialservice.dto.request.CreateTripShareRequest request
    ) {
        SocialPostResponse created = service.createTripShare(currentUser.requiredUser(), request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Trip shared successfully", created));
    }

    @PatchMapping("/posts/{postId}/visibility")
    public ApiResponse<SocialPostResponse> updateVisibility(
            @PathVariable UUID postId,
            @Valid @RequestBody fu.tripsense.socialservice.dto.request.UpdatePostVisibilityRequest request
    ) {
        SocialPostResponse updated = service.updateVisibility(postId, currentUser.requiredUser(), request.visibility());
        return ApiResponse.success("Post visibility updated", updated);
    }

    @GetMapping("/trip-shares/{postId}")
    public ApiResponse<fu.tripsense.socialservice.dto.response.TripShareDetailResponse> getTripShareDetail(@PathVariable UUID postId) {
        return ApiResponse.success(service.getTripShareDetail(postId, currentUser.optionalUser().orElse(null)));
    }

    @DeleteMapping("/posts/{postId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePost(@PathVariable UUID postId) {
        service.deletePost(postId, currentUser.requiredUser());
    }

    @PostMapping("/posts/{postId}/likes")
    public ApiResponse<ToggleLikeResponse> likePost(@PathVariable UUID postId) {
        return ApiResponse.success(service.setPostLike(postId, currentUser.requiredUser(), true));
    }

    @DeleteMapping("/posts/{postId}/likes")
    public ApiResponse<ToggleLikeResponse> unlikePost(@PathVariable UUID postId) {
        return ApiResponse.success(service.setPostLike(postId, currentUser.requiredUser(), false));
    }

    @GetMapping("/posts/{postId}/comments")
    public ApiResponse<List<PostCommentResponse>> listComments(@PathVariable UUID postId) {
        return ApiResponse.success(service.listComments(postId, currentUser.optionalUser().orElse(null)));
    }

    @PostMapping("/posts/{postId}/comments")
    public ResponseEntity<ApiResponse<PostCommentResponse>> createComment(
            @PathVariable UUID postId,
            @Valid @RequestBody CreateCommentRequest request
    ) {
        PostCommentResponse comment = service.createComment(postId, currentUser.requiredUser(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Comment created", comment));
    }

    @PostMapping("/posts/{postId}/comments/{commentId}/likes")
    public ApiResponse<ToggleLikeResponse> likeComment(
            @PathVariable UUID postId,
            @PathVariable UUID commentId
    ) {
        return ApiResponse.success(service.setCommentLike(postId, commentId, currentUser.requiredUser(), true));
    }

    @DeleteMapping("/posts/{postId}/comments/{commentId}/likes")
    public ApiResponse<ToggleLikeResponse> unlikeComment(
            @PathVariable UUID postId,
            @PathVariable UUID commentId
    ) {
        return ApiResponse.success(service.setCommentLike(postId, commentId, currentUser.requiredUser(), false));
    }

    @PostMapping("/media/upload-signature")
    public ApiResponse<UploadSignatureResponse> uploadSignature(@Valid @RequestBody UploadSignatureRequest request) {
        return ApiResponse.success(service.createUploadSignature(currentUser.requiredUser(), request));
    }
}
