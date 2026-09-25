package fu.tripsense.socialservice.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.socialservice.client.PublicProfileClientResponse;
import fu.tripsense.socialservice.client.TripPublicationClientResponse;
import fu.tripsense.socialservice.client.TripServiceClient;
import fu.tripsense.socialservice.client.UserPublicProfileClient;
import fu.tripsense.socialservice.dto.request.CreateCommentRequest;
import fu.tripsense.socialservice.dto.request.CreatePostRequest;
import fu.tripsense.socialservice.dto.request.CreateTripShareRequest;
import fu.tripsense.socialservice.dto.request.PostMediaInput;
import fu.tripsense.socialservice.dto.request.RefreshTripSharePublicationRequest;
import fu.tripsense.socialservice.dto.request.TripSharePreviewRequest;
import fu.tripsense.socialservice.dto.request.UpdatePostContentRequest;
import fu.tripsense.socialservice.dto.request.UploadSignatureRequest;
import fu.tripsense.socialservice.dto.response.*;
import fu.tripsense.socialservice.entity.*;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.*;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import fu.tripsense.socialservice.security.CurrentUserProvider;
import fu.tripsense.socialservice.service.SocialPostService;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SocialPostServiceImpl implements SocialPostService {

  private final SocialPostRepository posts;
  private final PostMediaRepository media;
  private final PostLikeRepository postLikes;
  private final SocialCommentRepository comments;
  private final CommentLikeRepository commentLikes;
  private final SocialTripShareRepository tripShares;
  private final SocialTripShareSnapshotRepository tripShareSnapshots;
  private final TripServiceClient tripServiceClient;
  private final CurrentUserProvider currentUserProvider;
  private final ObjectMapper objectMapper;
  private final TripShareWriter tripShareWriter;
  private final SocialUserFollowRepository userFollows;
  private final UserPublicProfileClient userPublicProfileClient;

  @Value("${cloudinary.cloud-name:}")
  private String cloudName;

  @Value("${cloudinary.api-key:}")
  private String cloudinaryApiKey;

  @Value("${cloudinary.api-secret:}")
  private String cloudinaryApiSecret;

  @Value("${cloudinary.folder-prefix:tripsense/social}")
  private String folderPrefix;

  @Value("${cloudinary.signature-algorithm:sha256}")
  private String signatureAlgorithm;

  @Override
  @Transactional(readOnly = true)
  public SocialPostPageResponse listPosts(
      UUID userId, String rawType, int page, int size, AuthenticatedUser viewer) {
    validatePage(page, size);
    String type = rawType == null ? "ALL" : rawType.trim().toUpperCase(Locale.ROOT);
    if (!Set.of("ALL", "STANDARD", "TRIP_SHARE").contains(type)) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST, "INVALID_POST_TYPE", "Type must be ALL, STANDARD, or TRIP_SHARE");
    }
    Pageable pageable =
        PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));

    Page<SocialPost> result;
    if ("TRIP_SHARE".equals(type) && viewer == null) {
      result = Page.empty(pageable);
    } else if (userId == null && "STANDARD".equals(type)) {
      result = posts.findByPostTypeAndDeletedAtIsNull("STANDARD", pageable);
    } else if (userId == null && "TRIP_SHARE".equals(type)) {
      result = posts.findPublicFeedByType("TRIP_SHARE", pageable);
    } else if (userId == null) {
      result =
          viewer == null
              ? posts.findByPostTypeAndDeletedAtIsNull("STANDARD", pageable)
              : posts.findPublicFeed(pageable);
    } else if (viewer != null && viewer.id().equals(userId) && !"ALL".equals(type)) {
      result = posts.findByAuthorIdAndPostTypeAndDeletedAtIsNull(userId, type, pageable);
    } else if (viewer != null && viewer.id().equals(userId)) {
      result = posts.findByAuthorIdAndDeletedAtIsNull(userId, pageable);
    } else if ("STANDARD".equals(type)) {
      result = posts.findByAuthorIdAndPostTypeAndDeletedAtIsNull(userId, "STANDARD", pageable);
    } else if ("TRIP_SHARE".equals(type)) {
      result = posts.findPublicPostsByAuthorIdAndType(userId, "TRIP_SHARE", pageable);
    } else {
      result =
          viewer == null
              ? posts.findByAuthorIdAndPostTypeAndDeletedAtIsNull(userId, "STANDARD", pageable)
              : posts.findPublicPostsByAuthorId(userId, pageable);
    }

    return new SocialPostPageResponse(
        toPosts(result.getContent(), viewer),
        result.getTotalElements(),
        page,
        size,
        result.hasNext());
  }

  @Override
  @Transactional(readOnly = true)
  public SocialPostResponse getPost(UUID postId, AuthenticatedUser viewer) {
    SocialPost post = requireViewablePost(postId, viewer);
    return toPosts(List.of(post), viewer).getFirst();
  }

  @Override
  @Transactional
  public SocialPostResponse createPost(
      AuthenticatedUser user, CreatePostRequest request, UUID idempotencyKey) {
    String content = request.content() == null ? "" : request.content().trim();
    List<PostMediaInput> inputs = request.media() == null ? List.of() : request.media();

    if (content.isBlank() && inputs.isEmpty()) {
      throw validation("A post needs content or media");
    }
    if (content.length() > 5000) {
      throw validation("Content must be at most 5,000 characters");
    }
    if (inputs.size() > 10) {
      throw validation("A post may contain at most 10 media items");
    }
    validateMedia(inputs, user);

    Instant now = Instant.now();
    UUID postId = UUID.randomUUID();
    String authorName = displayName(user);

    SocialPost post =
        SocialPost.builder()
            .id(postId)
            .authorId(user.id())
            .authorDisplayName(authorName)
            .authorEmail(user.email())
            .postType("STANDARD")
            .idempotencyKey(idempotencyKey)
            .content(content)
            .likeCount(0)
            .commentCount(0)
            .createdAt(now)
            .updatedAt(now)
            .build();

    UUID insertedId =
        posts.insertPostIfAbsent(
            postId,
            user.id(),
            authorName,
            user.email(),
            idempotencyKey,
            content,
            "STANDARD",
            now,
            now);

    if (insertedId == null) {
      SocialPost existing =
          posts
              .findByAuthorIdAndIdempotencyKey(user.id(), idempotencyKey)
              .orElseThrow(() -> new IllegalStateException("Idempotent post was not found"));
      return toPosts(List.of(existing), user).getFirst();
    }

    for (PostMediaInput item : inputs) {
      media.save(
          PostMedia.builder()
              .id(UUID.randomUUID())
              .postId(post.getId())
              .publicId(item.publicId())
              .secureUrl(item.secureUrl())
              .resourceType(item.resourceType())
              .format(item.format())
              .width(item.width())
              .height(item.height())
              .sortOrder(item.sortOrder().shortValue())
              .createdAt(now)
              .build());
    }

    return toPosts(List.of(post), user).getFirst();
  }

  @Override
  @Transactional
  public SocialPostResponse updateContent(
      UUID postId, AuthenticatedUser user, UpdatePostContentRequest request) {
    SocialPost post = lockedPost(postId);
    if (!post.getAuthorId().equals(user.id())) {
      throw new SocialException(
          HttpStatus.FORBIDDEN, "FORBIDDEN", "Only post owner can edit content");
    }

    String content = request.content() == null ? "" : request.content().trim();
    if ("STANDARD".equals(post.getPostType()) && content.isBlank()) {
      throw validation("A standard post needs content");
    }
    if (content.length() > 5000) {
      throw validation("Content must be at most 5,000 characters");
    }

    post.setContent(content);
    post.setUpdatedAt(Instant.now());
    return toPosts(List.of(post), user).getFirst();
  }

  @Override
  public SocialPostResponse createTripShare(
      AuthenticatedUser user, CreateTripShareRequest request, UUID idempotencyKey) {
    if (idempotencyKey == null) {
      throw validation("Idempotency-Key header is required");
    }
    if (request.tripId() == null) {
      throw validation("tripId is required");
    }
    if (request.visibility() == null || request.visibility().isBlank()) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST, "INVALID_VISIBILITY", "Visibility must be selected explicitly");
    }
    String visibility = request.visibility().trim().toUpperCase(Locale.ROOT);
    if (!Set.of("PUBLIC", "UNLISTED", "PRIVATE").contains(visibility)) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST,
          "INVALID_VISIBILITY",
          "Visibility must be PUBLIC, UNLISTED, or PRIVATE");
    }
    validateConsent(request.expectedSnapshotFingerprint(), request.consentVersion());
    String caption = request.caption() == null ? "" : request.caption().trim();
    if (caption.length() > 5000) {
      throw validation("Caption must be at most 5,000 characters");
    }

    TripPublicationClientResponse publication =
        tripServiceClient.fetchPublicationSnapshot(
            request.tripId(), currentUserProvider.bearerToken());
    validatePublication(publication);
    if (!request.expectedSnapshotFingerprint().equals(publication.snapshotFingerprint())) {
      throw new SocialException(
          HttpStatus.CONFLICT,
          "PUBLICATION_PREVIEW_STALE",
          "Trip changed after preview; review the public snapshot again");
    }

    String authorName = displayName(user);
    SocialPost createdPost =
        tripShareWriter.create(
            user, idempotencyKey, authorName, caption, visibility, request.tripId(), publication);

    return toPosts(List.of(createdPost), user).getFirst();
  }

  @Override
  public TripSharePreviewResponse previewTripShare(
      AuthenticatedUser user, TripSharePreviewRequest request) {
    TripPublicationClientResponse publication =
        tripServiceClient.fetchPublicationSnapshot(
            request.tripId(), currentUserProvider.bearerToken());
    validatePublication(publication);
    return toPreview(publication);
  }

  @Override
  public TripShareDetailResponse refreshTripSharePublication(
      UUID postId,
      AuthenticatedUser user,
      RefreshTripSharePublicationRequest request,
      UUID idempotencyKey) {
    validateConsent(request.expectedSnapshotFingerprint(), request.consentVersion());
    SocialPost post = activePost(postId);
    SocialTripShare share =
        tripShares
            .findById(postId)
            .filter(value -> value.getRemovedAt() == null)
            .orElseThrow(
                () ->
                    new SocialException(
                        HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Trip share not found"));
    if (!post.getAuthorId().equals(user.id()) || !share.getAuthorId().equals(user.id())) {
      throw new SocialException(
          HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the publication owner can refresh it");
    }
    var existingRefresh =
        tripShareSnapshots.findByPostIdAndRefreshIdempotencyKey(postId, idempotencyKey);
    if (existingRefresh.isPresent()) {
      if (!Objects.equals(
          existingRefresh.get().getPayloadSha256(), request.expectedSnapshotFingerprint())) {
        throw new SocialException(
            HttpStatus.CONFLICT,
            "IDEMPOTENCY_KEY_REUSED",
            "Idempotency key was already used for a different publication snapshot");
      }
      return getTripShareDetail(postId, user);
    }

    TripPublicationClientResponse publication =
        tripServiceClient.fetchPublicationSnapshot(
            share.getSourceTripId(), currentUserProvider.bearerToken());
    validatePublication(publication);
    if (!request.expectedSnapshotFingerprint().equals(publication.snapshotFingerprint())) {
      throw new SocialException(
          HttpStatus.CONFLICT,
          "PUBLICATION_PREVIEW_STALE",
          "Trip changed after preview; review the public snapshot again");
    }
    tripShareWriter.refresh(postId, user, idempotencyKey, publication);
    return getTripShareDetail(postId, user);
  }

  @Override
  @Transactional
  public SocialPostResponse updateVisibility(
      UUID postId, AuthenticatedUser user, String rawVisibility) {
    if (rawVisibility == null || rawVisibility.isBlank()) {
      throw validation("Visibility is required");
    }
    String visibility = rawVisibility.trim().toUpperCase(Locale.ROOT);
    if (!Set.of("PUBLIC", "UNLISTED", "PRIVATE").contains(visibility)) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST,
          "INVALID_VISIBILITY",
          "Visibility must be PUBLIC, UNLISTED, or PRIVATE");
    }

    SocialPost post = lockedPost(postId);
    if (!post.getAuthorId().equals(user.id())) {
      throw new SocialException(
          HttpStatus.FORBIDDEN, "FORBIDDEN", "Only post owner can change visibility");
    }

    SocialTripShare share =
        tripShares
            .findById(postId)
            .filter(s -> s.getRemovedAt() == null)
            .orElseThrow(
                () ->
                    new SocialException(
                        HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Trip share not found"));

    share.setVisibility(visibility);
    share.setUpdatedAt(Instant.now());
    tripShares.save(share);

    return toPosts(List.of(post), user).getFirst();
  }

  @Override
  @Transactional(readOnly = true)
  public TripShareDetailResponse getTripShareDetail(UUID postId, AuthenticatedUser viewer) {
    SocialPost post = requireViewablePost(postId, viewer);
    SocialTripShare share =
        tripShares
            .findById(postId)
            .filter(s -> s.getRemovedAt() == null)
            .orElseThrow(
                () ->
                    new SocialException(
                        HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Trip share not found"));

    SocialPostResponse postResponse = toPosts(List.of(post), viewer).getFirst();
    PublicTripSnapshotResponse publication = null;
    if (share.getCurrentSnapshotVersion() != null) {
      var snapshot =
          tripShareSnapshots
              .findByPostIdAndSnapshotVersion(postId, share.getCurrentSnapshotVersion())
              .orElseThrow(
                  () ->
                      new SocialException(
                          HttpStatus.NOT_FOUND,
                          "PUBLICATION_NOT_FOUND",
                          "Published trip snapshot not found"));
      try {
        publication =
            objectMapper.readValue(snapshot.getPayloadJson(), PublicTripSnapshotResponse.class);
      } catch (Exception ex) {
        throw new SocialException(
            HttpStatus.BAD_GATEWAY,
            "INVALID_PUBLICATION_SNAPSHOT",
            "Published trip snapshot is invalid");
      }
    }
    return new TripShareDetailResponse(
        postResponse,
        publication,
        share.getDetailAvailability(),
        viewer != null && viewer.id().equals(post.getAuthorId()),
        viewer != null && viewer.id().equals(post.getAuthorId()) ? share.getSourceTripId() : null);
  }

  private void validateConsent(String fingerprint, String consentVersion) {
    if (!"PUBLIC_TRIP_V1".equals(consentVersion)) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST,
          "INVALID_CONSENT_VERSION",
          "consentVersion must be PUBLIC_TRIP_V1");
    }
    if (fingerprint == null || !fingerprint.matches("[0-9a-f]{64}")) {
      throw validation("expectedSnapshotFingerprint must be a lowercase SHA-256 value");
    }
  }

  private void validatePublication(TripPublicationClientResponse publication) {
    if (publication == null
        || publication.snapshot() == null
        || publication.snapshot().summary() == null
        || !"PUBLIC_TRIP_V1".equals(publication.consentVersion())
        || publication.snapshotFingerprint() == null
        || !publication.snapshotFingerprint().matches("[0-9a-f]{64}")) {
      throw new SocialException(
          HttpStatus.BAD_GATEWAY,
          "INVALID_TRIP_SNAPSHOT",
          "Trip service returned an invalid public snapshot");
    }
    var snapshot = publication.snapshot();
    if (snapshot.schemaVersion() != 1
        || snapshot.days() == null
        || snapshot.days().size() > 60
        || snapshot.summary().highlights() == null
        || snapshot.summary().highlights().size() > 3
        || snapshot.summary().itineraryItemCount() > 300
        || !validPublicationShape(snapshot)) {
      throw new SocialException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          "PUBLICATION_LIMIT_EXCEEDED",
          "Trip publication exceeds supported limits");
    }
    try {
      byte[] canonical =
          objectMapper
              .copy()
              .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true)
              .writeValueAsBytes(snapshot);
      if (canonical.length > 512 * 1024) {
        throw new SocialException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            "PUBLICATION_LIMIT_EXCEEDED",
            "Trip publication exceeds 512 KiB");
      }
      String computed =
          HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical));
      if (!computed.equals(publication.snapshotFingerprint())) {
        throw new SocialException(
            HttpStatus.BAD_GATEWAY,
            "INVALID_TRIP_SNAPSHOT",
            "Trip snapshot fingerprint does not match its payload");
      }
    } catch (SocialException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new SocialException(
          HttpStatus.BAD_GATEWAY, "INVALID_TRIP_SNAPSHOT", "Trip snapshot could not be verified");
    }
  }

  private boolean validPublicationShape(
      fu.tripsense.socialservice.client.PublicTripSnapshotClientResponse snapshot) {
    var summary = snapshot.summary();
    if (snapshot.publicationRevision() < 0
        || summary.name() == null
        || summary.name().isBlank()
        || summary.name().length() > 160
        || summary.destinationName() == null
        || summary.destinationName().isBlank()
        || summary.destinationName().length() > 255
        || !validPublicCover(summary.coverImageUrl())
        || summary.dayCount() != snapshot.days().size()
        || !Set.of("EXACT", "DAY_NUMBER_ONLY").contains(snapshot.datePrecision())
        || !Set.of("EXACT", "NONE").contains(snapshot.timePrecision())) {
      return false;
    }
    boolean exact =
        "EXACT".equals(snapshot.datePrecision()) && "EXACT".equals(snapshot.timePrecision());
    boolean redacted =
        "DAY_NUMBER_ONLY".equals(snapshot.datePrecision())
            && "NONE".equals(snapshot.timePrecision());
    if (!exact && !redacted) return false;
    for (var highlight : summary.highlights()) {
      if (highlight == null
          || highlight.title() == null
          || highlight.title().isBlank()
          || highlight.title().length() > 200
          || highlight.placeName() != null && highlight.placeName().length() > 255
          || highlight.dayNumber() < 1
          || highlight.dayNumber() > snapshot.days().size()) {
        return false;
      }
    }

    int totalItems = 0;
    for (int dayIndex = 0; dayIndex < snapshot.days().size(); dayIndex++) {
      var day = snapshot.days().get(dayIndex);
      if (day == null
          || day.dayNumber() != dayIndex + 1
          || day.items() == null
          || day.items().size() > 50
          || exact && day.date() == null
          || redacted && day.date() != null) {
        return false;
      }
      totalItems += day.items().size();
      for (int itemIndex = 0; itemIndex < day.items().size(); itemIndex++) {
        var item = day.items().get(itemIndex);
        if (item == null
            || item.order() != itemIndex + 1
            || item.title() == null
            || item.title().isBlank()
            || item.title().length() > 200
            || !Set.of("PLACE", "MEAL", "ACTIVITY", "HOTEL", "FLIGHT", "TRANSFER")
                .contains(item.type())
            || item.placeName() != null && item.placeName().length() > 255
            || redacted
                && (item.startTime() != null
                    || item.endTime() != null
                    || item.durationMinutes() != null)) {
          return false;
        }
      }
    }
    return totalItems == summary.itineraryItemCount() && totalItems <= 300;
  }

  private boolean validPublicCover(String coverImageUrl) {
    if (coverImageUrl == null || coverImageUrl.isBlank()) return true;
    if (coverImageUrl.length() > 2048) return false;
    try {
      URI uri = URI.create(coverImageUrl);
      return "https".equalsIgnoreCase(uri.getScheme())
          && Set.of("images.unsplash.com", "res.cloudinary.com").contains(uri.getHost());
    } catch (IllegalArgumentException ex) {
      return false;
    }
  }

  private TripSharePreviewResponse toPreview(TripPublicationClientResponse publication) {
    PublicTripSnapshotResponse snapshot =
        objectMapper.convertValue(publication.snapshot(), PublicTripSnapshotResponse.class);
    return new TripSharePreviewResponse(
        snapshot,
        publication.snapshotFingerprint(),
        publication.consentVersion(),
        publication.warnings() == null ? List.of() : publication.warnings());
  }

  @Override
  @Transactional
  public void deletePost(UUID postId, AuthenticatedUser user) {
    SocialPost post = lockedPost(postId);
    boolean isOwner = post.getAuthorId().equals(user.id());
    boolean isAdmin = "ROLE_ADMIN".equals(normalizedRole(user));

    if (!isOwner && !isAdmin) {
      throw new SocialException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You cannot delete this post");
    }

    Instant now = Instant.now();
    post.setDeletedAt(now);
    post.setDeletedByUserId(user.id());
    post.setUpdatedAt(now);

    tripShares
        .findById(postId)
        .ifPresent(
            share -> {
              share.setRemovedAt(now);
              share.setUpdatedAt(now);
              tripShares.save(share);
            });
  }

  @Override
  @Transactional
  public ToggleLikeResponse setPostLike(UUID postId, AuthenticatedUser user, boolean liked) {
    SocialPost post = requireViewableLockedPost(postId, user);
    PostLike.PostLikeId id = new PostLike.PostLikeId(postId, user.id());
    boolean exists = postLikes.existsById(id);

    if (liked && !exists) {
      postLikes.save(new PostLike(id, Instant.now()));
      post.setLikeCount(post.getLikeCount() + 1);
    }
    if (!liked && exists) {
      postLikes.deleteById(id);
      post.setLikeCount(Math.max(0, post.getLikeCount() - 1));
    }

    return new ToggleLikeResponse(liked, post.getLikeCount());
  }

  @Override
  @Transactional(readOnly = true)
  public List<PostCommentResponse> listComments(UUID postId, AuthenticatedUser viewer) {
    requireViewablePost(postId, viewer);
    List<SocialComment> list = comments.findByPostIdAndDeletedAtIsNullOrderByCreatedAtAsc(postId);

    Set<UUID> liked =
        (viewer == null)
            ? Set.of()
            : commentLikes
                .findByIdCommentIdInAndIdUserId(
                    list.stream().map(SocialComment::getId).toList(), viewer.id())
                .stream()
                .map(x -> x.getId().getCommentId())
                .collect(Collectors.toSet());

    List<UUID> commentAuthorIds = list.stream().map(SocialComment::getAuthorId).distinct().toList();
    Map<UUID, PublicProfileClientResponse> profilesByUserId =
        (userPublicProfileClient == null || commentAuthorIds.isEmpty())
            ? Map.of()
            : userPublicProfileClient.fetchPublicProfiles(commentAuthorIds);

    Map<UUID, String> names =
        list.stream()
            .collect(Collectors.toMap(SocialComment::getId, SocialComment::getAuthorDisplayName));

    return list.stream()
        .map(
            c -> {
              PublicProfileClientResponse profile = profilesByUserId.get(c.getAuthorId());
              String authorAvatar = profile != null ? profile.avatarUrl() : null;
              String authorName =
                  (profile != null && profile.displayName() != null && !profile.displayName().isBlank())
                      ? profile.displayName()
                      : c.getAuthorDisplayName();
              return new PostCommentResponse(
                  c.getId(),
                  c.getPostId(),
                  c.getParentCommentId(),
                  author(c.getAuthorId(), authorName, authorAvatar, false),
                  c.getContent(),
                  c.getCreatedAt(),
                  c.getLikeCount(),
                  liked.contains(c.getId()),
                  c.getReplyToAuthorName() != null
                      ? c.getReplyToAuthorName()
                      : (c.getParentCommentId() == null
                          ? null
                          : names.get(c.getParentCommentId())));
            })
        .toList();
  }

  @Override
  @Transactional
  public PostCommentResponse createComment(
      UUID postId, AuthenticatedUser user, CreateCommentRequest request) {
    SocialPost post = requireViewableLockedPost(postId, user);
    String content = request.content() == null ? "" : request.content().trim();
    if (content.isBlank()) {
      throw validation("Comment content is required");
    }
    if (content.length() > 2000) {
      throw validation("Comment must be at most 2,000 characters");
    }

    UUID requestedParentId = request.parentId();
    UUID effectiveParentId = null;
    String replyToAuthorName = null;

    if (requestedParentId != null) {
      SocialComment targetParent =
          comments
              .findByIdAndPostIdAndDeletedAtIsNull(requestedParentId, postId)
              .orElseThrow(
                  () ->
                      new SocialException(
                          HttpStatus.NOT_FOUND, "COMMENT_NOT_FOUND", "Parent comment not found"));

      replyToAuthorName = targetParent.getAuthorDisplayName();

      if (targetParent.getParentCommentId() == null) {
        // targetParent is Level 1 (Root comment) -> New comment becomes Level 2
        effectiveParentId = targetParent.getId();
      } else {
        // targetParent has a parent. Check if grandparent exists and is root or level 2
        SocialComment parentOfTarget =
            comments
                .findByIdAndPostIdAndDeletedAtIsNull(targetParent.getParentCommentId(), postId)
                .orElse(null);
        if (parentOfTarget == null || parentOfTarget.getParentCommentId() == null) {
          // parentOfTarget is Root -> targetParent is Level 2 -> New comment becomes Level 3
          effectiveParentId = targetParent.getId();
        } else {
          // parentOfTarget is Level 2 (or deeper) -> targetParent is ALREADY Level 3 (or deeper)
          // CLAMP: Tree maximum depth is 3 generations (A -> B -> C).
          // Prevent Level 4+ by anchoring new comment to targetParent's parent (Level 2) as
          // sibling.
          effectiveParentId = targetParent.getParentCommentId();
        }
      }
    }

    Instant now = Instant.now();
    SocialComment comment =
        comments.save(
            SocialComment.builder()
                .id(UUID.randomUUID())
                .postId(postId)
                .parentCommentId(effectiveParentId)
                .authorId(user.id())
                .authorDisplayName(displayName(user))
                .authorEmail(user.email())
                .content(content)
                .likeCount(0)
                .replyToAuthorName(replyToAuthorName)
                .createdAt(now)
                .updatedAt(now)
                .build());

    post.setCommentCount(post.getCommentCount() + 1);

    PublicProfileClientResponse profile = null;
    if (userPublicProfileClient != null) {
      Map<UUID, PublicProfileClientResponse> profiles =
          userPublicProfileClient.fetchPublicProfiles(List.of(user.id()));
      profile = profiles.get(user.id());
    }
    String authorAvatar = profile != null ? profile.avatarUrl() : null;
    String authorName =
        (profile != null && profile.displayName() != null && !profile.displayName().isBlank())
            ? profile.displayName()
            : comment.getAuthorDisplayName();

    return new PostCommentResponse(
        comment.getId(),
        comment.getPostId(),
        comment.getParentCommentId(),
        author(comment.getAuthorId(), authorName, authorAvatar, false),
        comment.getContent(),
        comment.getCreatedAt(),
        0,
        false,
        replyToAuthorName);
  }

  @Override
  @Transactional
  public ToggleLikeResponse setCommentLike(
      UUID postId, UUID commentId, AuthenticatedUser user, boolean liked) {
    requireViewableLockedPost(postId, user);
    SocialComment comment =
        comments
            .lockActiveByIdAndPostId(commentId, postId)
            .orElseThrow(
                () ->
                    new SocialException(
                        HttpStatus.NOT_FOUND, "COMMENT_NOT_FOUND", "Comment not found"));

    CommentLike.CommentLikeId id = new CommentLike.CommentLikeId(commentId, user.id());
    boolean exists = commentLikes.existsById(id);

    if (liked && !exists) {
      commentLikes.save(new CommentLike(id, Instant.now()));
      comment.setLikeCount(comment.getLikeCount() + 1);
    }
    if (!liked && exists) {
      commentLikes.deleteById(id);
      comment.setLikeCount(Math.max(0, comment.getLikeCount() - 1));
    }

    return new ToggleLikeResponse(liked, comment.getLikeCount());
  }

  @Override
  public UploadSignatureResponse createUploadSignature(
      AuthenticatedUser user, UploadSignatureRequest request) {
    if (!"image".equals(request.resourceType())) {
      throw validation("Only image uploads are supported");
    }
    if (cloudName.isBlank() || cloudinaryApiKey.isBlank() || cloudinaryApiSecret.isBlank()) {
      throw new SocialException(
          HttpStatus.SERVICE_UNAVAILABLE, "UPLOAD_UNAVAILABLE", "Media upload is not configured");
    }

    long timestamp = Instant.now().getEpochSecond();
    String folder = folderPrefix + "/" + user.id();
    List<String> formats = List.of("jpg", "jpeg", "png", "webp", "avif");

    String toSign = "folder=" + folder + "&timestamp=" + timestamp + cloudinaryApiSecret;

    return new UploadSignatureResponse(
        cloudName,
        cloudinaryApiKey,
        timestamp,
        calculateSignature(toSign),
        folder,
        "image",
        formats);
  }

  private List<SocialPostResponse> toPosts(List<SocialPost> postList, AuthenticatedUser viewer) {
    if (postList.isEmpty()) {
      return List.of();
    }

    List<UUID> ids = postList.stream().map(SocialPost::getId).toList();
    Map<UUID, List<String>> urls =
        media.findByPostIdInOrderBySortOrderAsc(ids).stream()
            .collect(
                Collectors.groupingBy(
                    PostMedia::getPostId,
                    Collectors.mapping(PostMedia::getSecureUrl, Collectors.toList())));

    Set<UUID> liked =
        (viewer == null)
            ? Set.of()
            : postLikes.findByIdPostIdInAndIdUserId(ids, viewer.id()).stream()
                .map(x -> x.getId().getPostId())
                .collect(Collectors.toSet());

    Map<UUID, SocialTripShare> sharesByPostId =
        tripShares.findByPostIdIn(ids).stream()
            .collect(Collectors.toMap(SocialTripShare::getPostId, Function.identity()));

    List<UUID> authorIds = postList.stream().map(SocialPost::getAuthorId).distinct().toList();
    Map<UUID, PublicProfileClientResponse> profilesByUserId =
        (userPublicProfileClient == null || authorIds.isEmpty())
            ? Map.of()
            : userPublicProfileClient.fetchPublicProfiles(authorIds);

    Set<UUID> followedAuthorIds =
        (viewer == null || userFollows == null || authorIds.isEmpty())
            ? Set.of()
            : userFollows
                .findByIdFollowerUserIdAndIdFollowedUserIdIn(viewer.id(), authorIds)
                .stream()
                .map(f -> f.getId().getFollowedUserId())
                .collect(Collectors.toSet());

    return postList.stream()
        .map(
            p -> {
              SocialTripShare share = sharesByPostId.get(p.getId());
              SharedTripSummaryResponse tripSummary = share != null ? toTripSummary(share) : null;
              String visibility = share != null ? share.getVisibility() : "PUBLIC";
              String postType = p.getPostType() != null ? p.getPostType() : "STANDARD";
              PublicProfileClientResponse profile = profilesByUserId.get(p.getAuthorId());
              String authorAvatar = profile != null ? profile.avatarUrl() : null;
              String authorName =
                  (profile != null && profile.displayName() != null && !profile.displayName().isBlank())
                      ? profile.displayName()
                      : p.getAuthorDisplayName();
              return new SocialPostResponse(
                  p.getId(),
                  postType,
                  author(
                      p.getAuthorId(),
                      authorName,
                      authorAvatar,
                      followedAuthorIds.contains(p.getAuthorId())),
                  p.getContent(),
                  urls.getOrDefault(p.getId(), List.of()),
                  visibility,
                  tripSummary,
                  p.getCreatedAt(),
                  p.getUpdatedAt(),
                  p.getLikeCount(),
                  p.getCommentCount(),
                  liked.contains(p.getId()));
            })
        .toList();
  }

  private SharedTripSummaryResponse toTripSummary(SocialTripShare s) {
    List<SharedTripHighlightResponse> highlights = List.of();
    if (s.getHighlightsJson() != null && !s.getHighlightsJson().isBlank()) {
      try {
        highlights =
            objectMapper.readValue(
                s.getHighlightsJson(), new TypeReference<List<SharedTripHighlightResponse>>() {});
      } catch (Exception ignored) {
      }
    }
    return new SharedTripSummaryResponse(
        s.getTripName(),
        s.getDestinationName(),
        s.getStartDate(),
        s.getEndDate(),
        s.getCoverImageUrl(),
        s.getDayCount(),
        s.getItineraryItemCount(),
        highlights,
        s.getPublicationRevision(),
        s.getCreatedAt(),
        s.getCurrentSnapshotVersion() != null && s.getCurrentSnapshotVersion() > 1
            ? s.getSnapshotCreatedAt()
            : null,
        s.getDetailAvailability(),
        s.getDatePrecision());
  }

  private SocialPost activePost(UUID id) {
    return posts
        .findByIdAndDeletedAtIsNull(id)
        .orElseThrow(
            () -> new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found"));
  }

  private SocialPost lockedPost(UUID id) {
    return posts
        .lockActiveById(id)
        .orElseThrow(
            () -> new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found"));
  }

  private SocialPost requireViewablePost(UUID id, AuthenticatedUser viewer) {
    SocialPost post = activePost(id);
    requireViewablePost(post, viewer);
    return post;
  }

  private SocialPost requireViewableLockedPost(UUID id, AuthenticatedUser viewer) {
    SocialPost post = lockedPost(id);
    requireViewablePost(post, viewer);
    return post;
  }

  private void requireViewablePost(SocialPost post, AuthenticatedUser viewer) {
    if (!"TRIP_SHARE".equals(post.getPostType())) {
      return;
    }

    if (viewer == null) {
      throw new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found");
    }

    SocialTripShare share =
        tripShares
            .findById(post.getId())
            .filter(s -> s.getRemovedAt() == null)
            .orElseThrow(
                () ->
                    new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found"));

    if ("PRIVATE".equals(share.getVisibility())
        && (viewer == null || !viewer.id().equals(post.getAuthorId()))) {
      throw new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found");
    }
  }

  private void validatePage(int page, int size) {
    if (page < 0 || size < 1 || size > 100) {
      throw validation("Invalid page or size");
    }
  }

  private void validateMedia(List<PostMediaInput> items, AuthenticatedUser user) {
    if (cloudName.isBlank()) {
      throw new SocialException(
          HttpStatus.SERVICE_UNAVAILABLE, "UPLOAD_UNAVAILABLE", "Media upload is not configured");
    }

    Set<Integer> order = new HashSet<>();
    Set<String> formats = Set.of("jpg", "jpeg", "png", "webp", "avif");
    String requiredPrefix = folderPrefix + "/" + user.id() + "/";

    for (PostMediaInput item : items) {
      if (!"image".equals(item.resourceType())
          || !formats.contains(item.format().toLowerCase(Locale.ROOT))
          || !order.add(item.sortOrder())
          || !item.publicId().startsWith(requiredPrefix)
          || !item.secureUrl().startsWith("https://res.cloudinary.com/" + cloudName + "/")) {
        throw new SocialException(
            HttpStatus.BAD_REQUEST,
            "INVALID_MEDIA",
            "Media must be a signed image owned by the current user");
      }
    }
  }

  private SocialPostAuthorResponse author(UUID id, String name) {
    return author(id, name, null, false);
  }

  private SocialPostAuthorResponse author(UUID id, String name, boolean isFollowing) {
    return author(id, name, null, isFollowing);
  }

  private SocialPostAuthorResponse author(UUID id, String name, String avatar, boolean isFollowing) {
    return new SocialPostAuthorResponse(id, name, avatar, isFollowing);
  }

  private String displayName(AuthenticatedUser user) {
    if (user.email() == null || user.email().isBlank()) {
      return "TripSense user";
    }
    int atIndex = user.email().indexOf('@');
    return atIndex > 0 ? user.email().substring(0, atIndex) : user.email();
  }

  private String normalizedRole(AuthenticatedUser user) {
    if (user.role() == null) {
      return "ROLE_USER";
    }
    return user.role().startsWith("ROLE_") ? user.role() : "ROLE_" + user.role();
  }

  private SocialException validation(String message) {
    return new SocialException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", message);
  }

  private String calculateSignature(String source) {
    String algorithm = "sha1".equalsIgnoreCase(signatureAlgorithm) ? "SHA-1" : "SHA-256";
    try {
      MessageDigest digest = MessageDigest.getInstance(algorithm);
      byte[] hash = digest.digest(source.getBytes(StandardCharsets.UTF_8));
      StringBuilder hexString = new StringBuilder();
      for (byte b : hash) {
        hexString.append(String.format("%02x", b));
      }
      return hexString.toString();
    } catch (Exception e) {
      throw new IllegalStateException("Failed to calculate signature with " + algorithm, e);
    }
  }
}
