package fu.tripsense.socialservice.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import fu.tripsense.socialservice.client.PublicTripSnapshotClientResponse;
import fu.tripsense.socialservice.client.TripPublicationClientResponse;
import fu.tripsense.socialservice.client.TripServiceClient;
import fu.tripsense.socialservice.dto.request.*;
import fu.tripsense.socialservice.dto.response.*;
import fu.tripsense.socialservice.entity.SocialPost;
import fu.tripsense.socialservice.entity.SocialTripShare;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.*;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import fu.tripsense.socialservice.security.CurrentUserProvider;
import fu.tripsense.socialservice.service.impl.SocialPostServiceImpl;
import fu.tripsense.socialservice.service.impl.TripShareWriter;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

class SocialPostServiceImplTest {
  private SocialPostRepository posts;
  private PostMediaRepository media;
  private PostLikeRepository postLikes;
  private SocialCommentRepository comments;
  private CommentLikeRepository commentLikes;
  private SocialTripShareRepository tripShares;
  private SocialTripShareSnapshotRepository tripShareSnapshots;
  private TripServiceClient tripServiceClient;
  private CurrentUserProvider currentUserProvider;
  private ObjectMapper objectMapper;
  private TripShareWriter tripShareWriter;
  private SocialUserFollowRepository userFollows;
  private SocialPostService service;
  private final AuthenticatedUser user =
      new AuthenticatedUser(UUID.randomUUID(), "author@tripsense.app", "ROLE_USER");

  @BeforeEach
  void setUp() {
    posts = mock(SocialPostRepository.class);
    media = mock(PostMediaRepository.class);
    postLikes = mock(PostLikeRepository.class);
    comments = mock(SocialCommentRepository.class);
    commentLikes = mock(CommentLikeRepository.class);
    tripShares = mock(SocialTripShareRepository.class);
    tripShareSnapshots = mock(SocialTripShareSnapshotRepository.class);
    tripServiceClient = mock(TripServiceClient.class);
    currentUserProvider = mock(CurrentUserProvider.class);
    userFollows = mock(SocialUserFollowRepository.class);
    objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    tripShareWriter = new TripShareWriter(posts, tripShares, tripShareSnapshots, objectMapper);

    service =
        new SocialPostServiceImpl(
            posts,
            media,
            postLikes,
            comments,
            commentLikes,
            tripShares,
            tripShareSnapshots,
            tripServiceClient,
            currentUserProvider,
            objectMapper,
            tripShareWriter,
            userFollows);
    ReflectionTestUtils.setField(service, "cloudName", "tripsense");
    ReflectionTestUtils.setField(service, "folderPrefix", "tripsense/social");
    ReflectionTestUtils.setField(service, "cloudinaryApiKey", "key");
    ReflectionTestUtils.setField(service, "cloudinaryApiSecret", "secret");
  }

  @Test
  void rejectsPostWithoutContentOrMedia() {
    assertThatThrownBy(
            () ->
                service.createPost(user, new CreatePostRequest("  ", List.of()), UUID.randomUUID()))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("content or media");
  }

  @Test
  void createsPostFromAuthenticatedUserAndVerifiedMedia() {
    when(posts.insertPostIfAbsent(any(), any(), any(), any(), any(), any(), any(), any(), any()))
        .thenAnswer(invocation -> invocation.getArgument(0));
    when(media.findByPostIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());
    PostMediaInput image =
        new PostMediaInput(
            "tripsense/social/" + user.id() + "/photo",
            "https://res.cloudinary.com/tripsense/image/upload/photo.jpg",
            "image",
            "jpg",
            1200,
            800,
            0);

    SocialPostResponse response =
        service.createPost(
            user, new CreatePostRequest("A real post", List.of(image)), UUID.randomUUID());

    assertThat(response.author().id()).isEqualTo(user.id());
    assertThat(response.author().name()).isEqualTo("author");
    assertThat(response.content()).isEqualTo("A real post");
    verify(media)
        .save(
            argThat(
                saved ->
                    saved.getPostId().equals(response.id())
                        && saved.getPublicId().equals(image.publicId())));
  }

  @Test
  void returnsExistingPostForTheSameUserAndIdempotencyKey() {
    UUID key = UUID.randomUUID();
    UUID postId = UUID.randomUUID();
    SocialPost existing =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .authorDisplayName(user.email())
            .content("already created")
            .likeCount(0)
            .commentCount(0)
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .idempotencyKey(key)
            .postType("STANDARD")
            .build();
    when(posts.insertPostIfAbsent(any(), any(), any(), any(), eq(key), any(), any(), any(), any()))
        .thenReturn(null);
    when(posts.findByAuthorIdAndIdempotencyKey(user.id(), key)).thenReturn(Optional.of(existing));
    when(media.findByPostIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());

    SocialPostResponse response =
        service.createPost(user, new CreatePostRequest("already created", List.of()), key);

    assertThat(response.id()).isEqualTo(postId);
    verify(media, never()).save(any());
  }

  @Test
  void createsTripShareSuccessfully() {
    UUID tripId = UUID.randomUUID();
    UUID key = UUID.randomUUID();
    TripPublicationClientResponse snapshot = publication();
    when(tripShares.findByAuthorIdAndSourceTripIdAndRemovedAtIsNull(user.id(), tripId))
        .thenReturn(Optional.empty());
    when(currentUserProvider.bearerToken()).thenReturn("mock-token");
    when(tripServiceClient.fetchPublicationSnapshot(eq(tripId), any())).thenReturn(snapshot);
    when(posts.insertPostIfAbsent(
            any(), any(), any(), any(), eq(key), any(), eq("TRIP_SHARE"), any(), any()))
        .thenAnswer(inv -> inv.getArgument(0));
    when(media.findByPostIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());

    SocialPostResponse response =
        service.createTripShare(
            user,
            new CreateTripShareRequest(
                tripId,
                "My awesome trip!",
                "PUBLIC",
                snapshot.snapshotFingerprint(),
                "PUBLIC_TRIP_V1"),
            key);

    assertThat(response.type()).isEqualTo("TRIP_SHARE");
    assertThat(response.content()).isEqualTo("My awesome trip!");
    assertThat(response.visibility()).isEqualTo("PUBLIC");
    verify(tripShares)
        .save(
            argThat(
                ts ->
                    ts.getSourceTripId().equals(tripId)
                        && ts.getTripName().equals("Da Nang Vacation")));
    verify(tripShareSnapshots)
        .save(
            argThat(
                saved ->
                    saved.getSnapshotVersion() == 1
                        && saved.getPayloadSha256().equals(snapshot.snapshotFingerprint())));
  }

  @Test
  void previewReturnsTheExactTripProjectionAndConsentFingerprint() {
    UUID tripId = UUID.randomUUID();
    when(currentUserProvider.bearerToken()).thenReturn("mock-token");
    when(tripServiceClient.fetchPublicationSnapshot(tripId, "mock-token"))
        .thenReturn(publication());

    TripSharePreviewResponse response =
        service.previewTripShare(user, new TripSharePreviewRequest(tripId));

    assertThat(response.snapshotFingerprint()).isEqualTo(publication().snapshotFingerprint());
    assertThat(response.consentVersion()).isEqualTo("PUBLIC_TRIP_V1");
    assertThat(response.snapshot().summary().name()).isEqualTo("Da Nang Vacation");
  }

  @Test
  void stalePreviewCannotCreateAPublication() {
    UUID tripId = UUID.randomUUID();
    when(currentUserProvider.bearerToken()).thenReturn("mock-token");
    when(tripServiceClient.fetchPublicationSnapshot(tripId, "mock-token"))
        .thenReturn(publication());

    assertThatThrownBy(
            () ->
                service.createTripShare(
                    user,
                    new CreateTripShareRequest(
                        tripId, "Caption", "PRIVATE", "b".repeat(64), "PUBLIC_TRIP_V1"),
                    UUID.randomUUID()))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("changed after preview");

    verify(posts, never())
        .insertPostIfAbsent(any(), any(), any(), any(), any(), any(), any(), any(), any());
  }

  @Test
  void typedDetailLoadsCurrentSnapshotAndOnlyOwnerReceivesSourceTripId() throws Exception {
    UUID postId = UUID.randomUUID();
    UUID tripId = UUID.randomUUID();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .authorDisplayName("author")
            .postType("TRIP_SHARE")
            .content("caption")
            .likeCount(0)
            .commentCount(0)
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    SocialTripShare share =
        SocialTripShare.builder()
            .postId(postId)
            .authorId(user.id())
            .sourceTripId(tripId)
            .visibility("PUBLIC")
            .tripName("Da Nang Vacation")
            .destinationName("Da Nang")
            .currentSnapshotVersion(1)
            .detailAvailability("PUBLIC_SNAPSHOT")
            .datePrecision("DAY_NUMBER_ONLY")
            .snapshotCreatedAt(Instant.now())
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    var stored =
        fu.tripsense.socialservice.entity.SocialTripShareSnapshot.builder()
            .postId(postId)
            .snapshotVersion(1)
            .payloadJson(objectMapper.writeValueAsString(publication().snapshot()))
            .payloadSha256(publication().snapshotFingerprint())
            .build();
    when(posts.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
    when(tripShares.findById(postId)).thenReturn(Optional.of(share));
    when(tripShares.findByPostIdIn(anyCollection())).thenReturn(List.of(share));
    when(media.findByPostIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());
    when(tripShareSnapshots.findByPostIdAndSnapshotVersion(postId, 1))
        .thenReturn(Optional.of(stored));

    TripShareDetailResponse ownerDetail = service.getTripShareDetail(postId, user);
    TripShareDetailResponse viewerDetail =
        service.getTripShareDetail(
            postId, new AuthenticatedUser(UUID.randomUUID(), "viewer@tripsense.app", "ROLE_USER"));

    assertThat(ownerDetail.publication()).isNotNull();
    assertThat(ownerDetail.sourceTripId()).isEqualTo(tripId);
    assertThat(viewerDetail.sourceTripId()).isNull();
  }

  @Test
  void retryingRefreshWithTheSameKeyReturnsTheStoredPublicationWithoutCallingTripService()
      throws Exception {
    UUID postId = UUID.randomUUID();
    UUID tripId = UUID.randomUUID();
    UUID refreshKey = UUID.randomUUID();
    TripPublicationClientResponse publication = publication();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .authorDisplayName("author")
            .postType("TRIP_SHARE")
            .content("caption")
            .likeCount(0)
            .commentCount(0)
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    SocialTripShare share =
        SocialTripShare.builder()
            .postId(postId)
            .authorId(user.id())
            .sourceTripId(tripId)
            .visibility("PUBLIC")
            .tripName("Da Nang Vacation")
            .destinationName("Da Nang")
            .currentSnapshotVersion(2)
            .detailAvailability("PUBLIC_SNAPSHOT")
            .datePrecision("DAY_NUMBER_ONLY")
            .snapshotCreatedAt(Instant.now())
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    var stored =
        fu.tripsense.socialservice.entity.SocialTripShareSnapshot.builder()
            .postId(postId)
            .snapshotVersion(2)
            .payloadJson(objectMapper.writeValueAsString(publication.snapshot()))
            .payloadSha256(publication.snapshotFingerprint())
            .refreshIdempotencyKey(refreshKey)
            .build();
    when(posts.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
    when(tripShares.findById(postId)).thenReturn(Optional.of(share));
    when(tripShares.findByPostIdIn(anyCollection())).thenReturn(List.of(share));
    when(media.findByPostIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());
    when(tripShareSnapshots.findByPostIdAndRefreshIdempotencyKey(postId, refreshKey))
        .thenReturn(Optional.of(stored));
    when(tripShareSnapshots.findByPostIdAndSnapshotVersion(postId, 2))
        .thenReturn(Optional.of(stored));

    TripShareDetailResponse result =
        service.refreshTripSharePublication(
            postId,
            user,
            new RefreshTripSharePublicationRequest(
                publication.snapshotFingerprint(), "PUBLIC_TRIP_V1"),
            refreshKey);

    assertThat(result.publication()).isNotNull();
    verifyNoInteractions(tripServiceClient);
  }

  @Test
  void rejectsDuplicateActiveTripShare() {
    UUID tripId = UUID.randomUUID();
    UUID key = UUID.randomUUID();
    SocialTripShare existingShare =
        SocialTripShare.builder()
            .postId(UUID.randomUUID())
            .sourceTripId(tripId)
            .authorId(user.id())
            .build();
    SocialPost existingPost =
        SocialPost.builder()
            .id(existingShare.getPostId())
            .authorId(user.id())
            .idempotencyKey(UUID.randomUUID())
            .build();

    when(tripShares.findByAuthorIdAndSourceTripIdAndRemovedAtIsNull(user.id(), tripId))
        .thenReturn(Optional.of(existingShare));
    when(posts.findByIdAndDeletedAtIsNull(existingShare.getPostId()))
        .thenReturn(Optional.of(existingPost));
    when(currentUserProvider.bearerToken()).thenReturn("mock-token");
    when(tripServiceClient.fetchPublicationSnapshot(eq(tripId), any())).thenReturn(publication());

    assertThatThrownBy(
            () ->
                service.createTripShare(
                    user,
                    new CreateTripShareRequest(
                        tripId,
                        "Caption",
                        "PUBLIC",
                        publication().snapshotFingerprint(),
                        "PUBLIC_TRIP_V1"),
                    key))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("already exists");
  }

  @Test
  void concurrentTripShareUniqueRaceReturnsConflictInsteadOfServerError() {
    UUID tripId = UUID.randomUUID();
    when(tripShares.findByAuthorIdAndSourceTripIdAndRemovedAtIsNull(user.id(), tripId))
        .thenReturn(Optional.empty());
    when(currentUserProvider.bearerToken()).thenReturn("mock-token");
    when(tripServiceClient.fetchPublicationSnapshot(eq(tripId), any())).thenReturn(publication());
    when(posts.insertPostIfAbsent(
            any(), any(), any(), any(), any(), any(), eq("TRIP_SHARE"), any(), any()))
        .thenAnswer(inv -> inv.getArgument(0));
    when(tripShares.saveAndFlush(any()))
        .thenThrow(new DataIntegrityViolationException("active share unique index"));

    assertThatThrownBy(
            () ->
                service.createTripShare(
                    user,
                    new CreateTripShareRequest(
                        tripId,
                        "Caption",
                        "PUBLIC",
                        publication().snapshotFingerprint(),
                        "PUBLIC_TRIP_V1"),
                    UUID.randomUUID()))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("already exists");
  }

  @Test
  void updateVisibilityRestrictedToOwner() {
    UUID postId = UUID.randomUUID();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .postType("TRIP_SHARE")
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    SocialTripShare share =
        SocialTripShare.builder().postId(postId).authorId(user.id()).visibility("PUBLIC").build();

    when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
    when(tripShares.findById(postId)).thenReturn(Optional.of(share));
    when(tripShares.findByPostIdIn(anyCollection())).thenReturn(List.of(share));

    AuthenticatedUser otherUser =
        new AuthenticatedUser(UUID.randomUUID(), "other@tripsense.app", "ROLE_USER");
    assertThatThrownBy(() -> service.updateVisibility(postId, otherUser, "PRIVATE"))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Only post owner");

    SocialPostResponse updated = service.updateVisibility(postId, user, "UNLISTED");
    assertThat(share.getVisibility()).isEqualTo("UNLISTED");
  }

  @Test
  void getTripShareDetailRejectsNonOwnerWhenPrivate() {
    UUID postId = UUID.randomUUID();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .postType("TRIP_SHARE")
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    SocialTripShare share =
        SocialTripShare.builder().postId(postId).authorId(user.id()).visibility("PRIVATE").build();

    when(posts.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
    when(tripShares.findById(postId)).thenReturn(Optional.of(share));
    when(media.findByPostIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());
    when(tripShares.findByPostIdIn(anyCollection())).thenReturn(List.of(share));

    AuthenticatedUser viewer =
        new AuthenticatedUser(UUID.randomUUID(), "viewer@tripsense.app", "ROLE_USER");
    assertThatThrownBy(() -> service.getTripShareDetail(postId, viewer))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Post not found");

    TripShareDetailResponse detail = service.getTripShareDetail(postId, user);
    assertThat(detail.post()).isNotNull();
    assertThat(detail.detailAvailability()).isEqualTo("SUMMARY_ONLY_REPUBLISH_REQUIRED");
    assertThat(detail.publication()).isNull();
  }

  @Test
  void unlistedTripShareRequiresSignInButAllowsSignedInDirectLink() {
    UUID postId = UUID.randomUUID();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .postType("TRIP_SHARE")
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    SocialTripShare share =
        SocialTripShare.builder()
            .postId(postId)
            .authorId(user.id())
            .visibility("UNLISTED")
            .detailAvailability("SUMMARY_ONLY_REPUBLISH_REQUIRED")
            .build();
    when(posts.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
    when(tripShares.findById(postId)).thenReturn(Optional.of(share));
    when(tripShares.findByPostIdIn(anyCollection())).thenReturn(List.of(share));
    when(media.findByPostIdInOrderBySortOrderAsc(anyCollection())).thenReturn(List.of());

    assertThatThrownBy(() -> service.getTripShareDetail(postId, null))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Post not found");

    TripShareDetailResponse detail =
        service.getTripShareDetail(
            postId, new AuthenticatedUser(UUID.randomUUID(), "viewer@tripsense.app", "ROLE_USER"));
    assertThat(detail.post().visibility()).isEqualTo("UNLISTED");
  }

  @Test
  void privateTripShareRejectsNonOwnerPostLike() {
    UUID postId = UUID.randomUUID();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .postType("TRIP_SHARE")
            .likeCount(0)
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    SocialTripShare share =
        SocialTripShare.builder().postId(postId).authorId(user.id()).visibility("PRIVATE").build();
    AuthenticatedUser viewer =
        new AuthenticatedUser(UUID.randomUUID(), "viewer@tripsense.app", "ROLE_USER");

    when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
    when(tripShares.findById(postId)).thenReturn(Optional.of(share));

    assertThatThrownBy(() -> service.setPostLike(postId, viewer, true))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Post not found");
    verify(postLikes, never()).save(any());
  }

  @Test
  void privateTripShareRejectsNonOwnerComments() {
    UUID postId = UUID.randomUUID();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .postType("TRIP_SHARE")
            .commentCount(0)
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    SocialTripShare share =
        SocialTripShare.builder().postId(postId).authorId(user.id()).visibility("PRIVATE").build();
    AuthenticatedUser viewer =
        new AuthenticatedUser(UUID.randomUUID(), "viewer@tripsense.app", "ROLE_USER");

    when(posts.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
    when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
    when(tripShares.findById(postId)).thenReturn(Optional.of(share));

    assertThatThrownBy(() -> service.listComments(postId, viewer))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Post not found");
    assertThatThrownBy(
            () ->
                service.createComment(postId, viewer, new CreateCommentRequest("Nice trip", null)))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Post not found");
    verify(comments, never()).findByPostIdAndDeletedAtIsNullOrderByCreatedAtAsc(any());
    verify(comments, never()).save(any());
  }

  @Test
  void privateTripShareRejectsNonOwnerCommentLike() {
    UUID postId = UUID.randomUUID();
    UUID commentId = UUID.randomUUID();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .postType("TRIP_SHARE")
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    SocialTripShare share =
        SocialTripShare.builder().postId(postId).authorId(user.id()).visibility("PRIVATE").build();
    AuthenticatedUser viewer =
        new AuthenticatedUser(UUID.randomUUID(), "viewer@tripsense.app", "ROLE_USER");

    when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
    when(tripShares.findById(postId)).thenReturn(Optional.of(share));

    assertThatThrownBy(() -> service.setCommentLike(postId, commentId, viewer, true))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Post not found");
    verify(commentLikes, never()).save(any());
  }

  @Test
  void deletePostSoftRemovesTripShare() {
    UUID postId = UUID.randomUUID();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .postType("TRIP_SHARE")
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    SocialTripShare share =
        SocialTripShare.builder().postId(postId).authorId(user.id()).visibility("PUBLIC").build();

    when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
    when(tripShares.findById(postId)).thenReturn(Optional.of(share));

    service.deletePost(postId, user);

    assertThat(post.getDeletedAt()).isNotNull();
    assertThat(share.getRemovedAt()).isNotNull();
    verify(tripShares).save(share);
  }

  @Test
  void rejectsCommentParentFromAnotherPost() {
    UUID postId = UUID.randomUUID();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .authorDisplayName(user.email())
            .content("post")
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
    when(comments.findByIdAndPostIdAndDeletedAtIsNull(any(), eq(postId)))
        .thenReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                service.createComment(
                    postId, user, new CreateCommentRequest("reply", UUID.randomUUID())))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("not found");
  }

  @Test
  void postLikeIsIdempotent() {
    UUID postId = UUID.randomUUID();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .authorDisplayName(user.email())
            .content("post")
            .likeCount(1)
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
    when(postLikes.existsById(any())).thenReturn(true);

    ToggleLikeResponse result = service.setPostLike(postId, user, true);

    assertThat(result).isEqualTo(new ToggleLikeResponse(true, 1));
    verify(postLikes, never()).save(any());
  }

  @Test
  void listsAnEmptyUserFeedWithoutSamplePosts() {
    when(posts.findByAuthorIdAndDeletedAtIsNull(eq(user.id()), any()))
        .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));

    SocialPostPageResponse result = service.listPosts(user.id(), "ALL", 0, 10, user);

    assertThat(result.items()).isEmpty();
    assertThat(result.total()).isZero();
    assertThat(result.hasMore()).isFalse();
  }

  @Test
  void anonymousFeedReadsStandardPostsOnly() {
    when(posts.findByPostTypeAndDeletedAtIsNull(eq("STANDARD"), any()))
        .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));

    SocialPostPageResponse result = service.listPosts(null, "ALL", 0, 10, null);

    assertThat(result.items()).isEmpty();
    verify(posts).findByPostTypeAndDeletedAtIsNull(eq("STANDARD"), any());
    verify(posts, never()).findPublicFeed(any());
  }

  @Test
  void anonymousTypedFeedIsAlwaysEmpty() {
    SocialPostPageResponse result = service.listPosts(null, "TRIP_SHARE", 0, 10, null);

    assertThat(result.items()).isEmpty();
    verifyNoInteractions(media, postLikes);
    verify(posts, never()).findPublicFeedByType(anyString(), any());
  }

  @Test
  void rejectsUnknownPostTypeFilter() {
    assertThatThrownBy(() -> service.listPosts(null, "TRENDING", 0, 10, user))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("STANDARD");
  }

  @Test
  void typedShareRequiresExplicitVisibility() {
    assertThatThrownBy(
            () ->
                service.createTripShare(
                    user,
                    new CreateTripShareRequest(
                        UUID.randomUUID(), "Caption", null, "a".repeat(64), "PUBLIC_TRIP_V1"),
                    UUID.randomUUID()))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("selected explicitly");
    verifyNoInteractions(tripServiceClient);
  }

  private TripPublicationClientResponse publication() {
    PublicTripSnapshotClientResponse snapshot =
        new PublicTripSnapshotClientResponse(
            1,
            3,
            null,
            "DAY_NUMBER_ONLY",
            "NONE",
            new PublicTripSnapshotClientResponse.Summary(
                "Da Nang Vacation",
                "Da Nang",
                "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b",
                1,
                1,
                List.of(
                    new PublicTripSnapshotClientResponse.Highlight(
                        "Dragon Bridge", "Dragon Bridge", 1))),
            List.of(
                new PublicTripSnapshotClientResponse.Day(
                    1,
                    null,
                    List.of(
                        new PublicTripSnapshotClientResponse.Item(
                            1, "Dragon Bridge", "PLACE", null, null, null, "Dragon Bridge")))));
    try {
      byte[] canonical =
          objectMapper
              .copy()
              .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true)
              .writeValueAsBytes(snapshot);
      String fingerprint =
          HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical));
      return new TripPublicationClientResponse(
          snapshot, fingerprint, "PUBLIC_TRIP_V1", List.of("EXACT_DATES_AND_TIMES_HIDDEN"));
    } catch (Exception ex) {
      throw new IllegalStateException(ex);
    }
  }

  @Test
  void rejectsStandardPostContentOverFiveThousandCharacters() {
    assertThatThrownBy(
            () ->
                service.createPost(
                    user, new CreatePostRequest("x".repeat(5001), List.of()), UUID.randomUUID()))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("5,000");
  }

  @Test
  void missingDetailIsNotConvertedToDefaultPost() {
    UUID postId = UUID.randomUUID();
    when(posts.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.getPost(postId, null))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Post not found");
  }

  @Test
  void deleteAllowsOwnerButRejectsAnotherUser() {
    UUID postId = UUID.randomUUID();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .authorDisplayName(user.email())
            .content("post")
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));

    service.deletePost(postId, user);
    assertThat(post.getDeletedAt()).isNotNull();

    SocialPost differentPost =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .authorDisplayName(user.email())
            .content("post")
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    when(posts.lockActiveById(postId)).thenReturn(Optional.of(differentPost));
    AuthenticatedUser other =
        new AuthenticatedUser(UUID.randomUUID(), "other@tripsense.app", "ROLE_USER");
    assertThatThrownBy(() -> service.deletePost(postId, other))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("cannot delete");
  }

  @Test
  void adminCanDeleteAnotherUsersPost() {
    UUID postId = UUID.randomUUID();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(UUID.randomUUID())
            .authorDisplayName("owner")
            .content("post")
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));

    service.deletePost(
        postId, new AuthenticatedUser(UUID.randomUUID(), "admin@tripsense.app", "ROLE_ADMIN"));

    assertThat(post.getDeletedAt()).isNotNull();
  }

  @Test
  void createsRootCommentAndPreservesItsParentRelationship() {
    UUID postId = UUID.randomUUID();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .authorDisplayName(user.email())
            .content("post")
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
    when(comments.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

    PostCommentResponse response =
        service.createComment(postId, user, new CreateCommentRequest("A root comment", null));

    assertThat(response.parentId()).isNull();
    assertThat(response.author().id()).isEqualTo(user.id());
    assertThat(post.getCommentCount()).isEqualTo(1);
  }

  @Test
  void commentLikeIsIdempotentAndChecksPostMembership() {
    UUID postId = UUID.randomUUID();
    UUID commentId = UUID.randomUUID();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .authorDisplayName(user.email())
            .content("post")
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    fu.tripsense.socialservice.entity.SocialComment comment =
        fu.tripsense.socialservice.entity.SocialComment.builder()
            .id(commentId)
            .postId(postId)
            .authorId(user.id())
            .authorDisplayName(user.email())
            .content("comment")
            .likeCount(2)
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
    when(comments.lockActiveByIdAndPostId(commentId, postId)).thenReturn(Optional.of(comment));
    when(commentLikes.existsById(any())).thenReturn(true);

    ToggleLikeResponse result = service.setCommentLike(postId, commentId, user, true);

    assertThat(result).isEqualTo(new ToggleLikeResponse(true, 2));
    verify(commentLikes, never()).save(any());
  }

  @Test
  void createsUploadSignatureWithSha256ByDefault() {
    UploadSignatureResponse response =
        service.createUploadSignature(user, new UploadSignatureRequest("image"));

    assertThat(response.cloudName()).isEqualTo("tripsense");
    assertThat(response.apiKey()).isEqualTo("key");
    assertThat(response.folder()).isEqualTo("tripsense/social/" + user.id());
    assertThat(response.signature()).isNotEmpty().hasSize(64);
    assertThat(response.allowedFormats()).contains("jpg", "jpeg", "png", "webp", "avif");
  }

  @Test
  void createsUploadSignatureWithSha1WhenConfigured() {
    ReflectionTestUtils.setField(service, "signatureAlgorithm", "sha1");

    UploadSignatureResponse response =
        service.createUploadSignature(user, new UploadSignatureRequest("image"));

    assertThat(response.signature()).isNotEmpty().hasSize(40);
  }

  @Test
  void rejectsUploadSignatureWhenCloudinaryNotConfigured() {
    ReflectionTestUtils.setField(service, "cloudName", "");

    assertThatThrownBy(
            () -> service.createUploadSignature(user, new UploadSignatureRequest("image")))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Media upload is not configured");
  }

  @Test
  void rejectsUploadSignatureForNonImageResourceType() {
    assertThatThrownBy(
            () -> service.createUploadSignature(user, new UploadSignatureRequest("video")))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Only image uploads are supported");
  }

  @Test
  void createsThreeGenerationsAndClampsFourthGenerationToThird() {
    UUID postId = UUID.randomUUID();
    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .authorDisplayName(user.email())
            .content("post")
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();
    when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));
    when(comments.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

    // 1. Root comment A (Level 1)
    UUID commentAId = UUID.randomUUID();
    fu.tripsense.socialservice.entity.SocialComment commentA =
        fu.tripsense.socialservice.entity.SocialComment.builder()
            .id(commentAId)
            .postId(postId)
            .authorId(user.id())
            .authorDisplayName("User A")
            .parentCommentId(null)
            .build();
    when(comments.findByIdAndPostIdAndDeletedAtIsNull(commentAId, postId))
        .thenReturn(Optional.of(commentA));

    // 2. Reply B to A (Level 2)
    PostCommentResponse responseB =
        service.createComment(postId, user, new CreateCommentRequest("Reply B to A", commentAId));
    assertThat(responseB.parentId()).isEqualTo(commentAId);
    assertThat(responseB.replyToAuthorName()).isEqualTo("User A");

    UUID commentBId = UUID.randomUUID();
    fu.tripsense.socialservice.entity.SocialComment commentB =
        fu.tripsense.socialservice.entity.SocialComment.builder()
            .id(commentBId)
            .postId(postId)
            .authorId(user.id())
            .authorDisplayName("User B")
            .parentCommentId(commentAId)
            .build();
    when(comments.findByIdAndPostIdAndDeletedAtIsNull(commentBId, postId))
        .thenReturn(Optional.of(commentB));

    // 3. Reply C to B (Level 3)
    PostCommentResponse responseC =
        service.createComment(postId, user, new CreateCommentRequest("Reply C to B", commentBId));
    assertThat(responseC.parentId()).isEqualTo(commentBId);
    assertThat(responseC.replyToAuthorName()).isEqualTo("User B");

    UUID commentCId = UUID.randomUUID();
    fu.tripsense.socialservice.entity.SocialComment commentC =
        fu.tripsense.socialservice.entity.SocialComment.builder()
            .id(commentCId)
            .postId(postId)
            .authorId(user.id())
            .authorDisplayName("User C")
            .parentCommentId(commentBId)
            .build();
    when(comments.findByIdAndPostIdAndDeletedAtIsNull(commentCId, postId))
        .thenReturn(Optional.of(commentC));

    // 4. Reply F to C (Would be Level 4, but gets clamped to Level 3 under B!)
    PostCommentResponse responseF =
        service.createComment(postId, user, new CreateCommentRequest("Reply F to C", commentCId));
    assertThat(responseF.parentId()).isEqualTo(commentBId); // Clamped to B!
    assertThat(responseF.replyToAuthorName()).isEqualTo("User C"); // Preserves mention of C!
  }

  @Test
  void ensuresSingleConstructorExistsForSpringAutowiring() {
    assertThat(SocialPostServiceImpl.class.getConstructors()).hasSize(1);
    assertThat(SocialPostServiceImpl.class.getConstructors()[0].getParameterCount()).isEqualTo(12);
  }
}
