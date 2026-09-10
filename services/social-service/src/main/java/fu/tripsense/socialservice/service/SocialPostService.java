package fu.tripsense.socialservice.service;

import fu.tripsense.socialservice.dto.request.*;
import fu.tripsense.socialservice.dto.response.*;
import fu.tripsense.socialservice.security.AuthenticatedUser;

import java.util.List;
import java.util.UUID;

public interface SocialPostService {
    SocialPostPageResponse listPosts(UUID userId, int page, int size, AuthenticatedUser viewer);
    SocialPostResponse getPost(UUID postId, AuthenticatedUser viewer);
    SocialPostResponse createPost(AuthenticatedUser user, CreatePostRequest request, UUID idempotencyKey);
    SocialPostResponse updateContent(UUID postId, AuthenticatedUser user, UpdatePostContentRequest request);
    void deletePost(UUID postId, AuthenticatedUser user);
    ToggleLikeResponse setPostLike(UUID postId, AuthenticatedUser user, boolean liked);
    List<PostCommentResponse> listComments(UUID postId, AuthenticatedUser viewer);
    PostCommentResponse createComment(UUID postId, AuthenticatedUser user, CreateCommentRequest request);
    ToggleLikeResponse setCommentLike(UUID postId, UUID commentId, AuthenticatedUser user, boolean liked);
    UploadSignatureResponse createUploadSignature(AuthenticatedUser user, UploadSignatureRequest request);

    SocialPostResponse createTripShare(AuthenticatedUser user, CreateTripShareRequest request, UUID idempotencyKey);
    SocialPostResponse updateVisibility(UUID postId, AuthenticatedUser user, String visibility);
    TripShareDetailResponse getTripShareDetail(UUID postId, AuthenticatedUser viewer);
}
