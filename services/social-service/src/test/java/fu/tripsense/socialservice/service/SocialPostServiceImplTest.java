package fu.tripsense.socialservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import fu.tripsense.socialservice.client.TripServiceClient;
import fu.tripsense.socialservice.client.TripSnapshotClientResponse;
import fu.tripsense.socialservice.dto.request.*;
import fu.tripsense.socialservice.dto.response.*;
import fu.tripsense.socialservice.entity.SocialPost;
import fu.tripsense.socialservice.entity.SocialTripShare;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.*;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import fu.tripsense.socialservice.security.CurrentUserProvider;
import fu.tripsense.socialservice.service.impl.SocialPostServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SocialPostServiceImplTest {
    private SocialPostRepository posts;
    private PostMediaRepository media;
    private PostLikeRepository postLikes;
    private SocialCommentRepository comments;
    private CommentLikeRepository commentLikes;
    private SocialTripShareRepository tripShares;
    private TripServiceClient tripServiceClient;
    private CurrentUserProvider currentUserProvider;
    private ObjectMapper objectMapper;
    private SocialPostService service;
    private final AuthenticatedUser user = new AuthenticatedUser(UUID.randomUUID(), "author@tripsense.app", "ROLE_USER");

    @BeforeEach void setUp() {
        posts = mock(SocialPostRepository.class);
        media = mock(PostMediaRepository.class);
        postLikes = mock(PostLikeRepository.class);
        comments = mock(SocialCommentRepository.class);
        commentLikes = mock(CommentLikeRepository.class);
        tripShares = mock(SocialTripShareRepository.class);
        tripServiceClient = mock(TripServiceClient.class);
        currentUserProvider = mock(CurrentUserProvider.class);
        objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

        service = new SocialPostServiceImpl(posts, media, postLikes, comments, commentLikes, tripShares, tripServiceClient, currentUserProvider, objectMapper);
        ReflectionTestUtils.setField(service, "cloudName", "tripsense");
        ReflectionTestUtils.setField(service, "folderPrefix", "tripsense/social");
        ReflectionTestUtils.setField(service, "cloudinaryApiKey", "key");
        ReflectionTestUtils.setField(service, "cloudinaryApiSecret", "secret");
    }

    @Test void rejectsPostWithoutContentOrMedia() {
        assertThatThrownBy(() -> service.createPost(user, new CreatePostRequest("  ", List.of()), UUID.randomUUID()))
                .isInstanceOf(SocialException.class).hasMessageContaining("content or media");
    }

    @Test void createsPostFromAuthenticatedUserAndVerifiedMedia() {
        when(posts.insertPostIfAbsent(any(), any(), any(), any(), any(), any(), any(), any(), any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(media.findByPostIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());
        PostMediaInput image = new PostMediaInput("tripsense/social/" + user.id() + "/photo", "https://res.cloudinary.com/tripsense/image/upload/photo.jpg", "image", "jpg", 1200, 800, 0);

        SocialPostResponse response = service.createPost(user, new CreatePostRequest("A real post", List.of(image)), UUID.randomUUID());

        assertThat(response.author().id()).isEqualTo(user.id());
        assertThat(response.author().name()).isEqualTo("author");
        assertThat(response.content()).isEqualTo("A real post");
        verify(media).save(argThat(saved -> saved.getPostId().equals(response.id()) && saved.getPublicId().equals(image.publicId())));
    }

    @Test void returnsExistingPostForTheSameUserAndIdempotencyKey() {
        UUID key = UUID.randomUUID(); UUID postId = UUID.randomUUID();
        SocialPost existing = SocialPost.builder().id(postId).authorId(user.id()).authorDisplayName(user.email()).content("already created").likeCount(0).commentCount(0).createdAt(Instant.now()).updatedAt(Instant.now()).idempotencyKey(key).postType("STANDARD").build();
        when(posts.insertPostIfAbsent(any(), any(), any(), any(), eq(key), any(), any(), any(), any())).thenReturn(null);
        when(posts.findByAuthorIdAndIdempotencyKey(user.id(), key)).thenReturn(Optional.of(existing));
        when(media.findByPostIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());

        SocialPostResponse response = service.createPost(user, new CreatePostRequest("already created", List.of()), key);

        assertThat(response.id()).isEqualTo(postId);
        verify(media, never()).save(any());
    }

    @Test void createsTripShareSuccessfully() {
        UUID tripId = UUID.randomUUID();
        UUID key = UUID.randomUUID();
        TripSnapshotClientResponse snapshot = new TripSnapshotClientResponse(
                tripId, "Da Nang Vacation", "Da Nang", LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 14),
                "https://cover.jpg", 2, 5, 4,
                List.of(new TripSnapshotClientResponse.TripSnapshotHighlight("Dragon Bridge", "Dragon Bridge", 1)),
                List.of(),
                "DRAFT", Instant.now()
        );
        when(tripShares.findByAuthorIdAndSourceTripIdAndRemovedAtIsNull(user.id(), tripId)).thenReturn(Optional.empty());
        when(currentUserProvider.bearerToken()).thenReturn("mock-token");
        when(tripServiceClient.fetchShareSnapshot(eq(tripId), any())).thenReturn(snapshot);
        when(posts.insertPostIfAbsent(any(), any(), any(), any(), eq(key), any(), eq("TRIP_SHARE"), any(), any())).thenAnswer(inv -> inv.getArgument(0));
        when(media.findByPostIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());

        SocialPostResponse response = service.createTripShare(user, new CreateTripShareRequest(tripId, "My awesome trip!", "PUBLIC"), key);

        assertThat(response.type()).isEqualTo("TRIP_SHARE");
        assertThat(response.content()).isEqualTo("My awesome trip!");
        assertThat(response.visibility()).isEqualTo("PUBLIC");
        verify(tripShares).save(argThat(ts -> ts.getSourceTripId().equals(tripId) && ts.getTripName().equals("Da Nang Vacation")));
    }

    @Test void rejectsDuplicateActiveTripShare() {
        UUID tripId = UUID.randomUUID();
        UUID key = UUID.randomUUID();
        SocialTripShare existingShare = SocialTripShare.builder().postId(UUID.randomUUID()).sourceTripId(tripId).authorId(user.id()).build();
        SocialPost existingPost = SocialPost.builder().id(existingShare.getPostId()).authorId(user.id()).idempotencyKey(UUID.randomUUID()).build();

        when(tripShares.findByAuthorIdAndSourceTripIdAndRemovedAtIsNull(user.id(), tripId)).thenReturn(Optional.of(existingShare));
        when(posts.findByIdAndDeletedAtIsNull(existingShare.getPostId())).thenReturn(Optional.of(existingPost));

        assertThatThrownBy(() -> service.createTripShare(user, new CreateTripShareRequest(tripId, "Caption", "PUBLIC"), key))
                .isInstanceOf(SocialException.class)
                .hasMessageContaining("already exists");
    }

    @Test void updateVisibilityRestrictedToOwner() {
        UUID postId = UUID.randomUUID();
        SocialPost post = SocialPost.builder().id(postId).authorId(user.id()).postType("TRIP_SHARE").createdAt(Instant.now()).updatedAt(Instant.now()).build();
        SocialTripShare share = SocialTripShare.builder().postId(postId).authorId(user.id()).visibility("PUBLIC").build();

        when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
        when(tripShares.findById(postId)).thenReturn(Optional.of(share));
        when(tripShares.findByPostIdIn(anyCollection())).thenReturn(List.of(share));

        AuthenticatedUser otherUser = new AuthenticatedUser(UUID.randomUUID(), "other@tripsense.app", "ROLE_USER");
        assertThatThrownBy(() -> service.updateVisibility(postId, otherUser, "PRIVATE"))
                .isInstanceOf(SocialException.class)
                .hasMessageContaining("Only post owner");

        SocialPostResponse updated = service.updateVisibility(postId, user, "UNLISTED");
        assertThat(share.getVisibility()).isEqualTo("UNLISTED");
    }

    @Test void getTripShareDetailRejectsNonOwnerWhenPrivate() {
        UUID postId = UUID.randomUUID();
        SocialPost post = SocialPost.builder().id(postId).authorId(user.id()).postType("TRIP_SHARE").createdAt(Instant.now()).updatedAt(Instant.now()).build();
        SocialTripShare share = SocialTripShare.builder().postId(postId).authorId(user.id()).visibility("PRIVATE").build();

        when(posts.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
        when(tripShares.findById(postId)).thenReturn(Optional.of(share));

        AuthenticatedUser viewer = new AuthenticatedUser(UUID.randomUUID(), "viewer@tripsense.app", "ROLE_USER");
        assertThatThrownBy(() -> service.getTripShareDetail(postId, viewer))
                .isInstanceOf(SocialException.class)
                .hasMessageContaining("Post not found");

        TripShareDetailResponse detail = service.getTripShareDetail(postId, user);
        assertThat(detail.post()).isNotNull();
        assertThat(detail.tripUnavailableReason()).isEqualTo("SNAPSHOT_ONLY");
    }

    @Test void deletePostSoftRemovesTripShare() {
        UUID postId = UUID.randomUUID();
        SocialPost post = SocialPost.builder().id(postId).authorId(user.id()).postType("TRIP_SHARE").createdAt(Instant.now()).updatedAt(Instant.now()).build();
        SocialTripShare share = SocialTripShare.builder().postId(postId).authorId(user.id()).visibility("PUBLIC").build();

        when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
        when(tripShares.findById(postId)).thenReturn(Optional.of(share));

        service.deletePost(postId, user);

        assertThat(post.getDeletedAt()).isNotNull();
        assertThat(share.getRemovedAt()).isNotNull();
        verify(tripShares).save(share);
    }

    @Test void rejectsCommentParentFromAnotherPost() {
        UUID postId = UUID.randomUUID();
        SocialPost post = SocialPost.builder().id(postId).authorId(user.id()).authorDisplayName(user.email()).content("post").createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
        when(comments.findByIdAndPostIdAndDeletedAtIsNull(any(), eq(postId))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createComment(postId, user, new CreateCommentRequest("reply", UUID.randomUUID())))
                .isInstanceOf(SocialException.class).hasMessageContaining("not found");
    }

    @Test void postLikeIsIdempotent() {
        UUID postId = UUID.randomUUID();
        SocialPost post = SocialPost.builder().id(postId).authorId(user.id()).authorDisplayName(user.email()).content("post").likeCount(1).createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
        when(postLikes.existsById(any())).thenReturn(true);

        ToggleLikeResponse result = service.setPostLike(postId, user, true);

        assertThat(result).isEqualTo(new ToggleLikeResponse(true, 1));
        verify(postLikes, never()).save(any());
    }

    @Test void listsAnEmptyUserFeedWithoutSamplePosts() {
        when(posts.findByAuthorIdAndDeletedAtIsNull(eq(user.id()), any())).thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));

        SocialPostPageResponse result = service.listPosts(user.id(), 0, 10, user);

        assertThat(result.items()).isEmpty();
        assertThat(result.total()).isZero();
        assertThat(result.hasMore()).isFalse();
    }

    @Test void missingDetailIsNotConvertedToDefaultPost() {
        UUID postId = UUID.randomUUID();
        when(posts.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getPost(postId, null))
                .isInstanceOf(SocialException.class).hasMessageContaining("Post not found");
    }

    @Test void deleteAllowsOwnerButRejectsAnotherUser() {
        UUID postId = UUID.randomUUID();
        SocialPost post = SocialPost.builder().id(postId).authorId(user.id()).authorDisplayName(user.email()).content("post").createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));

        service.deletePost(postId, user);
        assertThat(post.getDeletedAt()).isNotNull();

        SocialPost differentPost = SocialPost.builder().id(postId).authorId(user.id()).authorDisplayName(user.email()).content("post").createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(posts.lockActiveById(postId)).thenReturn(Optional.of(differentPost));
        AuthenticatedUser other = new AuthenticatedUser(UUID.randomUUID(), "other@tripsense.app", "ROLE_USER");
        assertThatThrownBy(() -> service.deletePost(postId, other)).isInstanceOf(SocialException.class).hasMessageContaining("cannot delete");
    }

    @Test void adminCanDeleteAnotherUsersPost() {
        UUID postId = UUID.randomUUID();
        SocialPost post = SocialPost.builder().id(postId).authorId(UUID.randomUUID()).authorDisplayName("owner").content("post").createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));

        service.deletePost(postId, new AuthenticatedUser(UUID.randomUUID(), "admin@tripsense.app", "ROLE_ADMIN"));

        assertThat(post.getDeletedAt()).isNotNull();
    }

    @Test void createsRootCommentAndPreservesItsParentRelationship() {
        UUID postId = UUID.randomUUID();
        SocialPost post = SocialPost.builder().id(postId).authorId(user.id()).authorDisplayName(user.email()).content("post").createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
        when(comments.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        PostCommentResponse response = service.createComment(postId, user, new CreateCommentRequest("A root comment", null));

        assertThat(response.parentId()).isNull();
        assertThat(response.author().id()).isEqualTo(user.id());
        assertThat(post.getCommentCount()).isEqualTo(1);
    }

    @Test void commentLikeIsIdempotentAndChecksPostMembership() {
        UUID postId = UUID.randomUUID(); UUID commentId = UUID.randomUUID();
        SocialPost post = SocialPost.builder().id(postId).authorId(user.id()).authorDisplayName(user.email()).content("post").createdAt(Instant.now()).updatedAt(Instant.now()).build();
        fu.tripsense.socialservice.entity.SocialComment comment = fu.tripsense.socialservice.entity.SocialComment.builder().id(commentId).postId(postId).authorId(user.id()).authorDisplayName(user.email()).content("comment").likeCount(2).createdAt(Instant.now()).updatedAt(Instant.now()).build();
        when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
        when(comments.lockActiveByIdAndPostId(commentId, postId)).thenReturn(Optional.of(comment));
        when(commentLikes.existsById(any())).thenReturn(true);

        ToggleLikeResponse result = service.setCommentLike(postId, commentId, user, true);

        assertThat(result).isEqualTo(new ToggleLikeResponse(true, 2));
        verify(commentLikes, never()).save(any());
    }

    @Test void createsUploadSignatureWithSha256ByDefault() {
        UploadSignatureResponse response = service.createUploadSignature(user, new UploadSignatureRequest("image"));

        assertThat(response.cloudName()).isEqualTo("tripsense");
        assertThat(response.apiKey()).isEqualTo("key");
        assertThat(response.folder()).isEqualTo("tripsense/social/" + user.id());
        assertThat(response.signature()).isNotEmpty().hasSize(64);
        assertThat(response.allowedFormats()).contains("jpg", "jpeg", "png", "webp", "avif");
    }

    @Test void createsUploadSignatureWithSha1WhenConfigured() {
        ReflectionTestUtils.setField(service, "signatureAlgorithm", "sha1");

        UploadSignatureResponse response = service.createUploadSignature(user, new UploadSignatureRequest("image"));

        assertThat(response.signature()).isNotEmpty().hasSize(40);
    }

    @Test void rejectsUploadSignatureWhenCloudinaryNotConfigured() {
        ReflectionTestUtils.setField(service, "cloudName", "");

        assertThatThrownBy(() -> service.createUploadSignature(user, new UploadSignatureRequest("image")))
                .isInstanceOf(SocialException.class)
                .hasMessageContaining("Media upload is not configured");
    }

    @Test void rejectsUploadSignatureForNonImageResourceType() {
        assertThatThrownBy(() -> service.createUploadSignature(user, new UploadSignatureRequest("video")))
                .isInstanceOf(SocialException.class)
                .hasMessageContaining("Only image uploads are supported");
    }
}
