package fu.tripsense.socialservice.service;

import fu.tripsense.socialservice.client.PlaceClient;
import fu.tripsense.socialservice.client.PublicProfileClientResponse;
import fu.tripsense.socialservice.client.UserPublicProfileClient;
import fu.tripsense.socialservice.dto.request.PlaceReviewRequest;
import fu.tripsense.socialservice.dto.response.*;
import fu.tripsense.socialservice.entity.PlaceReview;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.PlaceReviewRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlaceReviewService {
  private static final String PUBLISHED = "PUBLISHED";
  private static final String REMOVED = "REMOVED";

  private final PlaceReviewRepository reviews;
  private final UserPublicProfileClient profiles;
  private final PlaceClient places;

  @Value("${community-reviews.write-enabled:false}")
  private boolean writesEnabled;

  @Transactional(readOnly = true)
  public PlaceReviewsResponse list(String placeRef, UUID currentUserId, int page, int size) {
    if (page < 0 || size < 1 || size > 50) {
      throw new SocialException(HttpStatus.BAD_REQUEST, "INVALID_PAGE", "Invalid pagination");
    }
    places.requireCanonical(placeRef);
    var result =
        reviews.findByPlaceRefAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
            placeRef, PUBLISHED, PageRequest.of(page, size));
    PlaceReview currentUserReview =
        currentUserId == null
            ? null
            : reviews
                .findByAuthorUserIdAndPlaceRefAndDeletedAtIsNull(currentUserId, placeRef)
                .filter(review -> PUBLISHED.equals(review.getStatus()))
                .orElse(null);
    List<UUID> authorIds =
        java.util.stream.Stream.concat(
                result.getContent().stream().map(PlaceReview::getAuthorUserId),
                currentUserReview == null
                    ? java.util.stream.Stream.empty()
                    : java.util.stream.Stream.of(currentUserReview.getAuthorUserId()))
            .distinct()
            .toList();
    Map<UUID, PublicProfileClientResponse> profileMap = profiles.fetchPublicProfiles(authorIds);
    Object[] aggregate = reviews.summarize(placeRef);
    long count = ((Number) aggregate[0]).longValue();
    double average =
        BigDecimal.valueOf(((Number) aggregate[1]).doubleValue())
            .setScale(1, RoundingMode.HALF_UP)
            .doubleValue();
    return new PlaceReviewsResponse(
        placeRef,
        new PlaceReviewSummaryResponse(average, count),
        page,
        size,
        result.getTotalElements(),
        result.getTotalPages(),
        result.getContent().stream()
            .map(
                review ->
                    toResponse(review, profileMap.get(review.getAuthorUserId()), currentUserId))
            .toList(),
        currentUserReview == null
            ? null
            : toResponse(
                currentUserReview,
                profileMap.get(currentUserReview.getAuthorUserId()),
                currentUserId));
  }

  @Transactional
  public PlaceReviewItemResponse create(
      UUID authorId, String placeRef, PlaceReviewRequest request) {
    requireWritesEnabled();
    places.requireCanonical(placeRef);
    if (reviews.findByAuthorUserIdAndPlaceRefAndDeletedAtIsNull(authorId, placeRef).isPresent()) {
      throw new SocialException(
          HttpStatus.CONFLICT, "REVIEW_ALREADY_EXISTS", "You already reviewed this place");
    }
    Instant now = Instant.now();
    PlaceReview review =
        PlaceReview.builder()
            .id(UUID.randomUUID())
            .placeRef(placeRef)
            .authorUserId(authorId)
            .rating(request.rating().shortValue())
            .content(normalizeContent(request.content()))
            .status(PUBLISHED)
            .createdAt(now)
            .updatedAt(now)
            .build();
    try {
      return toResponse(reviews.saveAndFlush(review), null, authorId);
    } catch (DataIntegrityViolationException exception) {
      throw new SocialException(
          HttpStatus.CONFLICT, "REVIEW_ALREADY_EXISTS", "You already reviewed this place");
    }
  }

  @Transactional
  public PlaceReviewItemResponse update(UUID authorId, UUID reviewId, PlaceReviewRequest request) {
    requireWritesEnabled();
    PlaceReview review = requireOwned(authorId, reviewId);
    if (request.version() == null || !Objects.equals(request.version(), review.getVersion())) {
      throw new SocialException(
          HttpStatus.CONFLICT, "REVIEW_STALE", "Review changed; refresh and try again");
    }
    review.setRating(request.rating().shortValue());
    review.setContent(normalizeContent(request.content()));
    review.setUpdatedAt(Instant.now());
    try {
      return toResponse(reviews.saveAndFlush(review), null, authorId);
    } catch (ObjectOptimisticLockingFailureException exception) {
      throw new SocialException(
          HttpStatus.CONFLICT, "REVIEW_STALE", "Review changed; refresh and try again");
    }
  }

  @Transactional
  public void delete(UUID authorId, UUID reviewId) {
    requireWritesEnabled();
    PlaceReview review = requireOwned(authorId, reviewId);
    review.setStatus(REMOVED);
    review.setDeletedAt(Instant.now());
    review.setUpdatedAt(Instant.now());
    reviews.save(review);
  }

  private PlaceReview requireOwned(UUID authorId, UUID reviewId) {
    PlaceReview review =
        reviews
            .findByIdAndDeletedAtIsNull(reviewId)
            .orElseThrow(
                () ->
                    new SocialException(
                        HttpStatus.NOT_FOUND, "REVIEW_NOT_FOUND", "Review not found"));
    if (!authorId.equals(review.getAuthorUserId())) {
      throw new SocialException(HttpStatus.NOT_FOUND, "REVIEW_NOT_FOUND", "Review not found");
    }
    return review;
  }

  private void requireWritesEnabled() {
    if (!writesEnabled) {
      throw new SocialException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "REVIEW_WRITES_DISABLED",
          "Community review writing is temporarily unavailable");
    }
  }

  private String normalizeContent(String value) {
    String content = value == null ? "" : value.trim().replace("\r\n", "\n");
    if (content.length() < 10 || content.length() > 2000) {
      throw new SocialException(
          HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_REVIEW", "Review content is invalid");
    }
    return content;
  }

  private PlaceReviewItemResponse toResponse(
      PlaceReview review, PublicProfileClientResponse profile, UUID currentUserId) {
    String displayName =
        profile != null && profile.displayName() != null
            ? profile.displayName()
            : "TripSense traveler "
                + review.getAuthorUserId().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    return new PlaceReviewItemResponse(
        review.getId(),
        new PlaceReviewAuthorResponse(
            review.getAuthorUserId(), displayName, profile == null ? null : profile.avatarUrl()),
        review.getRating(),
        review.getContent(),
        review.getCreatedAt(),
        review.getUpdatedAt(),
        review.getVersion() == null ? 0 : review.getVersion(),
        currentUserId != null && currentUserId.equals(review.getAuthorUserId()));
  }
}
