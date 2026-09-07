package fu.tripsense.socialservice.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.socialservice.client.TripServiceClient;
import fu.tripsense.socialservice.client.TripSnapshotClientResponse;
import fu.tripsense.socialservice.dto.request.CreateCommentRequest;
import fu.tripsense.socialservice.dto.request.CreatePostRequest;
import fu.tripsense.socialservice.dto.request.CreateTripShareRequest;
import fu.tripsense.socialservice.dto.request.PostMediaInput;
import fu.tripsense.socialservice.dto.request.UpdatePostContentRequest;
import fu.tripsense.socialservice.dto.request.UploadSignatureRequest;
import fu.tripsense.socialservice.dto.response.*;
import fu.tripsense.socialservice.entity.*;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.*;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import fu.tripsense.socialservice.security.CurrentUserProvider;
import fu.tripsense.socialservice.service.SocialPostService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SocialPostServiceImpl implements SocialPostService {

    private final SocialPostRepository posts;
    private final PostMediaRepository media;
    private final PostLikeRepository postLikes;
    private final SocialCommentRepository comments;
    private final CommentLikeRepository commentLikes;
    private final SocialTripShareRepository tripShares;
    private final TripServiceClient tripServiceClient;
    private final CurrentUserProvider currentUserProvider;
    private final ObjectMapper objectMapper;

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
    public SocialPostPageResponse listPosts(UUID userId, int page, int size, AuthenticatedUser viewer) {
        validatePage(page, size);
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));

        Page<SocialPost> result;
        if (userId == null) {
            result = viewer == null
                    ? posts.findPublicFeed(pageable)
                    : posts.findVisibleFeedForViewer(viewer.id(), pageable);
        } else if (viewer != null && viewer.id().equals(userId)) {
            result = posts.findByAuthorIdAndDeletedAtIsNull(userId, pageable);
        } else {
            result = viewer == null
                    ? posts.findPublicPostsByAuthorId(userId, pageable)
                    : posts.findVisiblePostsByAuthorId(userId, viewer.id(), pageable);
        }

        return new SocialPostPageResponse(
                toPosts(result.getContent(), viewer),
                result.getTotalElements(),
                page,
                size,
                result.hasNext()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public SocialPostResponse getPost(UUID postId, AuthenticatedUser viewer) {
        SocialPost post = activePost(postId);
        if ("TRIP_SHARE".equals(post.getPostType())) {
            SocialTripShare share = tripShares.findById(postId)
                    .filter(s -> s.getRemovedAt() == null)
                    .orElseThrow(() -> new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found"));
            if ("PRIVATE".equals(share.getVisibility())) {
                if (viewer == null || !viewer.id().equals(post.getAuthorId())) {
                    throw new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found");
                }
            } else if ("UNLISTED".equals(share.getVisibility()) && viewer == null) {
                throw new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found");
            }
        }
        return toPosts(List.of(post), viewer).getFirst();
    }

    @Override
    @Transactional
    public SocialPostResponse createPost(AuthenticatedUser user, CreatePostRequest request, UUID idempotencyKey) {
        String content = request.content() == null ? "" : request.content().trim();
        List<PostMediaInput> inputs = request.media() == null ? List.of() : request.media();

        if (content.isBlank() && inputs.isEmpty()) {
            throw validation("A post needs content or media");
        }
        if (inputs.size() > 10) {
            throw validation("A post may contain at most 10 media items");
        }
        validateMedia(inputs, user);

        Instant now = Instant.now();
        UUID postId = UUID.randomUUID();
        String authorName = displayName(user);

        SocialPost post = SocialPost.builder()
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

        UUID insertedId = posts.insertPostIfAbsent(
                postId,
                user.id(),
                authorName,
                user.email(),
                idempotencyKey,
                content,
                "STANDARD",
                now,
                now
        );

        if (insertedId == null) {
            SocialPost existing = posts.findByAuthorIdAndIdempotencyKey(user.id(), idempotencyKey)
                    .orElseThrow(() -> new IllegalStateException("Idempotent post was not found"));
            return toPosts(List.of(existing), user).getFirst();
        }

        for (PostMediaInput item : inputs) {
            media.save(PostMedia.builder()
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
    public SocialPostResponse updateContent(UUID postId, AuthenticatedUser user, UpdatePostContentRequest request) {
        SocialPost post = lockedPost(postId);
        if (!post.getAuthorId().equals(user.id())) {
            throw new SocialException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only post owner can edit content");
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
    @Transactional
    public SocialPostResponse createTripShare(AuthenticatedUser user, CreateTripShareRequest request, UUID idempotencyKey) {
        if (idempotencyKey == null) {
            throw validation("Idempotency-Key header is required");
        }
        if (request.tripId() == null) {
            throw validation("tripId is required");
        }
        String visibility = request.visibility() == null || request.visibility().isBlank()
                ? "PUBLIC"
                : request.visibility().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("PUBLIC", "UNLISTED", "PRIVATE").contains(visibility)) {
            throw new SocialException(HttpStatus.BAD_REQUEST, "INVALID_VISIBILITY", "Visibility must be PUBLIC, UNLISTED, or PRIVATE");
        }
        String caption = request.caption() == null ? "" : request.caption().trim();
        if (caption.length() > 5000) {
            throw validation("Caption must be at most 5,000 characters");
        }

        // Check if active share already exists for this author and trip
        Optional<SocialTripShare> existingShare = tripShares.findByAuthorIdAndSourceTripIdAndRemovedAtIsNull(user.id(), request.tripId());
        if (existingShare.isPresent()) {
            SocialPost existingPost = posts.findByIdAndDeletedAtIsNull(existingShare.get().getPostId())
                    .orElse(null);
            if (existingPost != null && idempotencyKey.equals(existingPost.getIdempotencyKey())) {
                return toPosts(List.of(existingPost), user).getFirst();
            }
            throw new SocialException(HttpStatus.CONFLICT, "DUPLICATE_ACTIVE_TRIP_SHARE", "An active shared post already exists for this trip");
        }

        // Synchronously fetch safe snapshot from trip-service
        TripSnapshotClientResponse snapshot = tripServiceClient.fetchShareSnapshot(request.tripId(), currentUserProvider.bearerToken());

        Instant now = Instant.now();
        UUID postId = UUID.randomUUID();
        String authorName = displayName(user);

        UUID insertedId = posts.insertPostIfAbsent(
                postId,
                user.id(),
                authorName,
                user.email(),
                idempotencyKey,
                caption,
                "TRIP_SHARE",
                now,
                now
        );

        if (insertedId == null) {
            SocialPost existing = posts.findByAuthorIdAndIdempotencyKey(user.id(), idempotencyKey)
                    .orElseThrow(() -> new IllegalStateException("Idempotent post was not found"));
            return toPosts(List.of(existing), user).getFirst();
        }

        String highlightsJson = "[]";
        if (snapshot.highlights() != null && !snapshot.highlights().isEmpty()) {
            try {
                highlightsJson = objectMapper.writeValueAsString(snapshot.highlights());
            } catch (Exception ignored) {}
        }
        String itineraryJson = "[]";
        if (snapshot.itineraryDays() != null && !snapshot.itineraryDays().isEmpty()) {
            try {
                itineraryJson = objectMapper.writeValueAsString(snapshot.itineraryDays());
            } catch (Exception ignored) {}
        }

        SocialTripShare share = SocialTripShare.builder()
                .postId(postId)
                .authorId(user.id())
                .sourceTripId(snapshot.tripId())
                .visibility(visibility)
                .tripName(snapshot.name())
                .destinationName(snapshot.destinationName())
                .startDate(snapshot.startDate())
                .endDate(snapshot.endDate())
                .coverImageUrl(snapshot.coverImageUrl())
                .travelerCount(snapshot.travelerCount())
                .dayCount(snapshot.dayCount())
                .itineraryItemCount(snapshot.itineraryItemCount())
                .highlightsJson(highlightsJson)
                .itineraryJson(itineraryJson)
                .snapshotCreatedAt(snapshot.updatedAt() != null ? snapshot.updatedAt() : now)
                .createdAt(now)
                .updatedAt(now)
                .build();

        tripShares.save(share);

        SocialPost createdPost = SocialPost.builder()
                .id(postId)
                .authorId(user.id())
                .authorDisplayName(authorName)
                .authorEmail(user.email())
                .postType("TRIP_SHARE")
                .idempotencyKey(idempotencyKey)
                .content(caption)
                .likeCount(0)
                .commentCount(0)
                .createdAt(now)
                .updatedAt(now)
                .build();

        return toPosts(List.of(createdPost), user).getFirst();
    }

    @Override
    @Transactional
    public SocialPostResponse updateVisibility(UUID postId, AuthenticatedUser user, String rawVisibility) {
        if (rawVisibility == null || rawVisibility.isBlank()) {
            throw validation("Visibility is required");
        }
        String visibility = rawVisibility.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("PUBLIC", "UNLISTED", "PRIVATE").contains(visibility)) {
            throw new SocialException(HttpStatus.BAD_REQUEST, "INVALID_VISIBILITY", "Visibility must be PUBLIC, UNLISTED, or PRIVATE");
        }

        SocialPost post = lockedPost(postId);
        if (!post.getAuthorId().equals(user.id())) {
            throw new SocialException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only post owner can change visibility");
        }

        SocialTripShare share = tripShares.findById(postId)
                .filter(s -> s.getRemovedAt() == null)
                .orElseThrow(() -> new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Trip share not found"));

        share.setVisibility(visibility);
        share.setUpdatedAt(Instant.now());
        tripShares.save(share);

        return toPosts(List.of(post), user).getFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public TripShareDetailResponse getTripShareDetail(UUID postId, AuthenticatedUser viewer) {
        SocialPost post = activePost(postId);
        SocialTripShare share = tripShares.findById(postId)
                .filter(s -> s.getRemovedAt() == null)
                .orElseThrow(() -> new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Trip share not found"));

        if ("PRIVATE".equals(share.getVisibility())) {
            if (viewer == null || !viewer.id().equals(post.getAuthorId())) {
                throw new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found");
            }
        } else if ("UNLISTED".equals(share.getVisibility()) && viewer == null) {
            throw new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found");
        }

        SocialPostResponse postResponse = toPosts(List.of(post), viewer).getFirst();
        return new TripShareDetailResponse(postResponse, false, "SNAPSHOT_ONLY");
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

        tripShares.findById(postId).ifPresent(share -> {
            share.setRemovedAt(now);
            share.setUpdatedAt(now);
            tripShares.save(share);
        });
    }

    @Override
    @Transactional
    public ToggleLikeResponse setPostLike(UUID postId, AuthenticatedUser user, boolean liked) {
        SocialPost post = lockedPost(postId);
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
        activePost(postId);
        List<SocialComment> list = comments.findByPostIdAndDeletedAtIsNullOrderByCreatedAtAsc(postId);

        Set<UUID> liked = (viewer == null)
                ? Set.of()
                : commentLikes.findByIdCommentIdInAndIdUserId(
                        list.stream().map(SocialComment::getId).toList(),
                        viewer.id()
                ).stream().map(x -> x.getId().getCommentId()).collect(Collectors.toSet());

        Map<UUID, String> names = list.stream()
                .collect(Collectors.toMap(SocialComment::getId, SocialComment::getAuthorDisplayName));

        return list.stream().map(c -> new PostCommentResponse(
                c.getId(),
                c.getPostId(),
                c.getParentCommentId(),
                author(c.getAuthorId(), c.getAuthorDisplayName()),
                c.getContent(),
                c.getCreatedAt(),
                c.getLikeCount(),
                liked.contains(c.getId()),
                c.getParentCommentId() == null ? null : names.get(c.getParentCommentId())
        )).toList();
    }

    @Override
    @Transactional
    public PostCommentResponse createComment(UUID postId, AuthenticatedUser user, CreateCommentRequest request) {
        SocialPost post = lockedPost(postId);
        String content = request.content() == null ? "" : request.content().trim();
        if (content.isBlank()) {
            throw validation("Comment content is required");
        }
        if (content.length() > 2000) {
            throw validation("Comment must be at most 2,000 characters");
        }

        UUID parentId = request.parentId();
        String replyToAuthorName = null;
        if (parentId != null) {
            SocialComment parent = comments.findByIdAndPostIdAndDeletedAtIsNull(parentId, postId)
                    .orElseThrow(() -> new SocialException(HttpStatus.NOT_FOUND, "COMMENT_NOT_FOUND", "Parent comment not found"));
            if (parent.getParentCommentId() != null) {
                throw validation("TripSense only supports one nesting level of replies");
            }
            replyToAuthorName = parent.getAuthorDisplayName();
        }

        Instant now = Instant.now();
        SocialComment comment = comments.save(SocialComment.builder()
                .id(UUID.randomUUID())
                .postId(postId)
                .parentCommentId(parentId)
                .authorId(user.id())
                .authorDisplayName(displayName(user))
                .authorEmail(user.email())
                .content(content)
                .likeCount(0)
                .createdAt(now)
                .updatedAt(now)
                .build());

        post.setCommentCount(post.getCommentCount() + 1);

        return new PostCommentResponse(
                comment.getId(),
                comment.getPostId(),
                comment.getParentCommentId(),
                author(comment.getAuthorId(), comment.getAuthorDisplayName()),
                comment.getContent(),
                comment.getCreatedAt(),
                0,
                false,
                replyToAuthorName
        );
    }

    @Override
    @Transactional
    public ToggleLikeResponse setCommentLike(UUID postId, UUID commentId, AuthenticatedUser user, boolean liked) {
        lockedPost(postId);
        SocialComment comment = comments.lockActiveByIdAndPostId(commentId, postId)
                .orElseThrow(() -> new SocialException(HttpStatus.NOT_FOUND, "COMMENT_NOT_FOUND", "Comment not found"));

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
    public UploadSignatureResponse createUploadSignature(AuthenticatedUser user, UploadSignatureRequest request) {
        if (!"image".equals(request.resourceType())) {
            throw validation("Only image uploads are supported");
        }
        if (cloudName.isBlank() || cloudinaryApiKey.isBlank() || cloudinaryApiSecret.isBlank()) {
            throw new SocialException(HttpStatus.SERVICE_UNAVAILABLE, "UPLOAD_UNAVAILABLE", "Media upload is not configured");
        }

        long timestamp = Instant.now().getEpochSecond();
        String folder = folderPrefix + "/" + user.id();
        List<String> formats = List.of("jpg", "jpeg", "png", "webp", "avif");

        String toSign = "folder=" + folder
                + "&timestamp=" + timestamp
                + cloudinaryApiSecret;

        return new UploadSignatureResponse(
                cloudName,
                cloudinaryApiKey,
                timestamp,
                calculateSignature(toSign),
                folder,
                "image",
                formats
        );
    }

    private List<SocialPostResponse> toPosts(List<SocialPost> postList, AuthenticatedUser viewer) {
        if (postList.isEmpty()) {
            return List.of();
        }

        List<UUID> ids = postList.stream().map(SocialPost::getId).toList();
        Map<UUID, List<String>> urls = media.findByPostIdInOrderBySortOrderAsc(ids).stream()
                .collect(Collectors.groupingBy(
                        PostMedia::getPostId,
                        Collectors.mapping(PostMedia::getSecureUrl, Collectors.toList())
                ));

        Set<UUID> liked = (viewer == null)
                ? Set.of()
                : postLikes.findByIdPostIdInAndIdUserId(ids, viewer.id()).stream()
                        .map(x -> x.getId().getPostId())
                        .collect(Collectors.toSet());

        Map<UUID, SocialTripShare> sharesByPostId = tripShares.findByPostIdIn(ids).stream()
                .collect(Collectors.toMap(SocialTripShare::getPostId, Function.identity()));

        return postList.stream().map(p -> {
            SocialTripShare share = sharesByPostId.get(p.getId());
            SharedTripSummaryResponse tripSummary = share != null ? toTripSummary(share) : null;
            String visibility = share != null ? share.getVisibility() : "PUBLIC";
            String postType = p.getPostType() != null ? p.getPostType() : "STANDARD";
            return new SocialPostResponse(
                    p.getId(),
                    postType,
                    author(p.getAuthorId(), p.getAuthorDisplayName()),
                    p.getContent(),
                    urls.getOrDefault(p.getId(), List.of()),
                    visibility,
                    tripSummary,
                    p.getCreatedAt(),
                    p.getUpdatedAt(),
                    p.getLikeCount(),
                    p.getCommentCount(),
                    liked.contains(p.getId())
            );
        }).toList();
    }

    private SharedTripSummaryResponse toTripSummary(SocialTripShare s) {
        List<SharedTripHighlightResponse> highlights = List.of();
        if (s.getHighlightsJson() != null && !s.getHighlightsJson().isBlank()) {
            try {
                highlights = objectMapper.readValue(
                        s.getHighlightsJson(),
                        new TypeReference<List<SharedTripHighlightResponse>>() {}
                );
            } catch (Exception ignored) {}
        }
        List<SharedTripItineraryDayResponse> itineraryDays = List.of();
        if (s.getItineraryJson() != null && !s.getItineraryJson().isBlank()) {
            try {
                itineraryDays = objectMapper.readValue(
                        s.getItineraryJson(),
                        new TypeReference<List<SharedTripItineraryDayResponse>>() {}
                );
            } catch (Exception ignored) {}
        }
        return new SharedTripSummaryResponse(
                s.getSourceTripId(),
                s.getTripName(),
                s.getDestinationName(),
                s.getStartDate(),
                s.getEndDate(),
                s.getCoverImageUrl(),
                s.getTravelerCount(),
                s.getDayCount(),
                s.getItineraryItemCount(),
                highlights,
                itineraryDays
        );
    }

    private SocialPost activePost(UUID id) {
        return posts.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found"));
    }

    private SocialPost lockedPost(UUID id) {
        return posts.lockActiveById(id)
                .orElseThrow(() -> new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found"));
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw validation("Invalid page or size");
        }
    }

    private void validateMedia(List<PostMediaInput> items, AuthenticatedUser user) {
        if (cloudName.isBlank()) {
            throw new SocialException(HttpStatus.SERVICE_UNAVAILABLE, "UPLOAD_UNAVAILABLE", "Media upload is not configured");
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
                        "Media must be a signed image owned by the current user"
                );
            }
        }
    }

    private SocialPostAuthorResponse author(UUID id, String name) {
        return new SocialPostAuthorResponse(id, name, null);
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
