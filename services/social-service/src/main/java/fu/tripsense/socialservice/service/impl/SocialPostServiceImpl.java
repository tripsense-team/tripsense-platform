package fu.tripsense.socialservice.service.impl;

import fu.tripsense.socialservice.dto.request.*;
import fu.tripsense.socialservice.dto.response.*;
import fu.tripsense.socialservice.entity.*;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.*;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import fu.tripsense.socialservice.service.SocialPostService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class SocialPostServiceImpl implements SocialPostService {
    private final SocialPostRepository posts;
    private final PostMediaRepository media;
    private final PostLikeRepository postLikes;
    private final SocialCommentRepository comments;
    private final CommentLikeRepository commentLikes;
    @Value("${cloudinary.cloud-name}") private String cloudName;
    @Value("${cloudinary.api-key}") private String cloudinaryApiKey;
    @Value("${cloudinary.api-secret}") private String cloudinaryApiSecret;
    @Value("${cloudinary.folder-prefix}") private String folderPrefix;

    @Override @Transactional(readOnly = true)
    public SocialPostPageResponse listPosts(UUID userId, int page, int size, AuthenticatedUser viewer) {
        validatePage(page, size);
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        Page<SocialPost> result = userId == null ? posts.findByDeletedAtIsNull(pageable) : posts.findByAuthorIdAndDeletedAtIsNull(userId, pageable);
        return new SocialPostPageResponse(toPosts(result.getContent(), viewer), result.getTotalElements(), page, size, result.hasNext());
    }

    @Override @Transactional(readOnly = true)
    public SocialPostResponse getPost(UUID postId, AuthenticatedUser viewer) { return toPosts(List.of(activePost(postId)), viewer).getFirst(); }

    @Override @Transactional
    public SocialPostResponse createPost(AuthenticatedUser user, CreatePostRequest request, UUID idempotencyKey) {
        String content = request.content() == null ? "" : request.content().trim();
        List<PostMediaInput> inputs = request.media() == null ? List.of() : request.media();
        if (content.isBlank() && inputs.isEmpty()) throw validation("A post needs content or media");
        if (inputs.size() > 10) throw validation("A post may contain at most 10 media items");
        validateMedia(inputs, user);
        Instant now = Instant.now(); UUID postId = UUID.randomUUID();
        SocialPost post = SocialPost.builder().id(postId).authorId(user.id()).authorDisplayName(displayName(user)).authorEmail(user.email()).idempotencyKey(idempotencyKey).content(content).likeCount(0).commentCount(0).createdAt(now).updatedAt(now).build();
        UUID insertedId = posts.insertPostIfAbsent(postId, user.id(), post.getAuthorDisplayName(), user.email(), idempotencyKey, content, now, now);
        if (insertedId == null) return toPosts(List.of(posts.findByAuthorIdAndIdempotencyKey(user.id(), idempotencyKey).orElseThrow(() -> new IllegalStateException("Idempotent post was not found"))), user).getFirst();
        for (PostMediaInput item : inputs) media.save(PostMedia.builder().id(UUID.randomUUID()).postId(post.getId()).publicId(item.publicId()).secureUrl(item.secureUrl()).resourceType(item.resourceType()).format(item.format()).width(item.width()).height(item.height()).sortOrder(item.sortOrder().shortValue()).createdAt(now).build());
        return toPosts(List.of(post), user).getFirst();
    }

    @Override @Transactional
    public void deletePost(UUID postId, AuthenticatedUser user) {
        SocialPost post = lockedPost(postId);
        if (!post.getAuthorId().equals(user.id()) && !"ROLE_ADMIN".equals(normalizedRole(user))) throw new SocialException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You cannot delete this post");
        post.setDeletedAt(Instant.now()); post.setDeletedByUserId(user.id()); post.setUpdatedAt(Instant.now());
    }

    @Override @Transactional
    public ToggleLikeResponse setPostLike(UUID postId, AuthenticatedUser user, boolean liked) {
        SocialPost post = lockedPost(postId); PostLike.PostLikeId id = new PostLike.PostLikeId(postId, user.id()); boolean exists = postLikes.existsById(id);
        if (liked && !exists) { postLikes.save(new PostLike(id, Instant.now())); post.setLikeCount(post.getLikeCount() + 1); }
        if (!liked && exists) { postLikes.deleteById(id); post.setLikeCount(Math.max(0, post.getLikeCount() - 1)); }
        return new ToggleLikeResponse(liked, post.getLikeCount());
    }

    @Override @Transactional(readOnly = true)
    public List<PostCommentResponse> listComments(UUID postId, AuthenticatedUser viewer) {
        activePost(postId);
        List<SocialComment> list = comments.findByPostIdAndDeletedAtIsNullOrderByCreatedAtAsc(postId);
        Set<UUID> liked = viewer == null ? Set.of() : commentLikes.findByIdCommentIdInAndIdUserId(list.stream().map(SocialComment::getId).toList(), viewer.id()).stream().map(x -> x.getId().getCommentId()).collect(Collectors.toSet());
        Map<UUID, String> names = list.stream().collect(Collectors.toMap(SocialComment::getId, SocialComment::getAuthorDisplayName));
        return list.stream().map(c -> new PostCommentResponse(c.getId(), c.getPostId(), c.getParentCommentId(), author(c.getAuthorId(), c.getAuthorDisplayName(), c.getAuthorEmail()), c.getContent(), c.getCreatedAt(), c.getLikeCount(), liked.contains(c.getId()), c.getParentCommentId() == null ? null : names.get(c.getParentCommentId()))).toList();
    }

    @Override @Transactional
    public PostCommentResponse createComment(UUID postId, AuthenticatedUser user, CreateCommentRequest request) {
        SocialPost post = lockedPost(postId); String content = request.content().trim(); if (content.isBlank()) throw validation("Comment content is required");
        UUID parentId = request.parentId(); String replyName = null;
        if (parentId != null) { SocialComment parent = comments.findByIdAndPostIdAndDeletedAtIsNull(parentId, postId).orElseThrow(() -> new SocialException(HttpStatus.BAD_REQUEST, "PARENT_COMMENT_INVALID", "Parent comment does not belong to this post")); replyName = parent.getAuthorDisplayName(); }
        Instant now = Instant.now(); SocialComment comment = comments.save(SocialComment.builder().id(UUID.randomUUID()).postId(postId).parentCommentId(parentId).authorId(user.id()).authorDisplayName(displayName(user)).authorEmail(user.email()).content(content).likeCount(0).createdAt(now).updatedAt(now).build());
        post.setCommentCount(post.getCommentCount() + 1); post.setUpdatedAt(now);
        return new PostCommentResponse(comment.getId(), postId, parentId, author(user.id(), displayName(user), user.email()), content, now, 0, false, replyName);
    }

    @Override @Transactional
    public ToggleLikeResponse setCommentLike(UUID postId, UUID commentId, AuthenticatedUser user, boolean liked) {
        lockedPost(postId); SocialComment comment = comments.lockActiveByIdAndPostId(commentId, postId).orElseThrow(() -> new SocialException(HttpStatus.NOT_FOUND, "COMMENT_NOT_FOUND", "Comment not found"));
        CommentLike.CommentLikeId id = new CommentLike.CommentLikeId(commentId, user.id()); boolean exists = commentLikes.existsById(id);
        if (liked && !exists) { commentLikes.save(new CommentLike(id, Instant.now())); comment.setLikeCount(comment.getLikeCount() + 1); }
        if (!liked && exists) { commentLikes.deleteById(id); comment.setLikeCount(Math.max(0, comment.getLikeCount() - 1)); }
        return new ToggleLikeResponse(liked, comment.getLikeCount());
    }

    @Override
    public UploadSignatureResponse createUploadSignature(AuthenticatedUser user, UploadSignatureRequest request) {
        if (!"image".equals(request.resourceType())) throw validation("Only image uploads are supported");
        if (cloudName.isBlank() || cloudinaryApiKey.isBlank() || cloudinaryApiSecret.isBlank()) throw new SocialException(HttpStatus.SERVICE_UNAVAILABLE, "UPLOAD_UNAVAILABLE", "Media upload is not configured");
        long timestamp = Instant.now().getEpochSecond(); String folder = folderPrefix + "/" + user.id(); List<String> formats = List.of("avif", "jpeg", "jpg", "png", "webp"); String allowedFormats = String.join(",", formats);
        return new UploadSignatureResponse(cloudName, cloudinaryApiKey, timestamp, sha1("allowed_formats=" + allowedFormats + "&folder=" + folder + "&timestamp=" + timestamp + cloudinaryApiSecret), folder, "image", formats);
    }

    private List<SocialPostResponse> toPosts(List<SocialPost> postList, AuthenticatedUser viewer) {
        if (postList.isEmpty()) return List.of(); List<UUID> ids = postList.stream().map(SocialPost::getId).toList();
        Map<UUID,List<String>> urls = media.findByPostIdInOrderBySortOrderAsc(ids).stream().collect(Collectors.groupingBy(PostMedia::getPostId, Collectors.mapping(PostMedia::getSecureUrl, Collectors.toList())));
        Set<UUID> liked = viewer == null ? Set.of() : postLikes.findByIdPostIdInAndIdUserId(ids, viewer.id()).stream().map(x -> x.getId().getPostId()).collect(Collectors.toSet());
        return postList.stream().map(p -> new SocialPostResponse(p.getId(), author(p.getAuthorId(),p.getAuthorDisplayName(),p.getAuthorEmail()),p.getContent(),urls.getOrDefault(p.getId(),List.of()),p.getCreatedAt(),p.getUpdatedAt(),p.getLikeCount(),p.getCommentCount(),liked.contains(p.getId()))).toList();
    }
    private SocialPost activePost(UUID id) { return posts.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found")); }
    private SocialPost lockedPost(UUID id) { return posts.lockActiveById(id).orElseThrow(() -> new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found")); }
    private void validatePage(int page,int size){if(page<0||size<1||size>100)throw validation("Invalid page or size");}
    private void validateMedia(List<PostMediaInput> items, AuthenticatedUser user) { if (cloudName.isBlank()) throw new SocialException(HttpStatus.SERVICE_UNAVAILABLE,"UPLOAD_UNAVAILABLE","Media upload is not configured"); Set<Integer> order=new HashSet<>(); Set<String> formats=Set.of("jpg","jpeg","png","webp","avif"); String required=folderPrefix + "/" + user.id() + "/"; for(PostMediaInput item:items){ if(!"image".equals(item.resourceType())||!formats.contains(item.format().toLowerCase(Locale.ROOT))||!order.add(item.sortOrder())||!item.publicId().startsWith(required)||!item.secureUrl().startsWith("https://res.cloudinary.com/" + cloudName + "/")) throw new SocialException(HttpStatus.BAD_REQUEST,"INVALID_MEDIA","Media must be a signed image owned by the current user"); } }
    private SocialPostAuthorResponse author(UUID id,String name,String email){return new SocialPostAuthorResponse(id,name,null,email);}
    private String displayName(AuthenticatedUser user){return user.email()==null||user.email().isBlank()?"TripSense user":user.email();}
    private String normalizedRole(AuthenticatedUser user){return user.role()==null?"ROLE_USER":user.role().startsWith("ROLE_")?user.role():"ROLE_"+user.role();}
    private SocialException validation(String message){return new SocialException(HttpStatus.BAD_REQUEST,"VALIDATION_FAILED",message);}
    private String sha1(String source){try{byte[] digest=MessageDigest.getInstance("SHA-1").digest(source.getBytes(StandardCharsets.UTF_8));StringBuilder b=new StringBuilder();for(byte x:digest)b.append(String.format("%02x",x));return b.toString();}catch(Exception e){throw new IllegalStateException(e);}}
}
