package fu.tripsense.socialservice.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.socialservice.client.PublicTripSnapshotClientResponse;
import fu.tripsense.socialservice.client.TripPublicationClientResponse;
import fu.tripsense.socialservice.entity.SocialPost;
import fu.tripsense.socialservice.entity.SocialTripShare;
import fu.tripsense.socialservice.entity.SocialTripShareSnapshot;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.SocialPostRepository;
import fu.tripsense.socialservice.repository.SocialTripShareRepository;
import fu.tripsense.socialservice.repository.SocialTripShareSnapshotRepository;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TripShareWriter {

  private final SocialPostRepository posts;
  private final SocialTripShareRepository tripShares;
  private final SocialTripShareSnapshotRepository snapshots;
  private final ObjectMapper objectMapper;

  @Transactional
  public SocialPost create(
      AuthenticatedUser user,
      UUID idempotencyKey,
      String authorName,
      String caption,
      String visibility,
      UUID sourceTripId,
      TripPublicationClientResponse publication) {
    PublicTripSnapshotClientResponse snapshot = publication.snapshot();
    var activeShare =
        tripShares.findByAuthorIdAndSourceTripIdAndRemovedAtIsNull(user.id(), sourceTripId);
    if (activeShare.isPresent()) {
      SocialPost existingPost =
          posts.findByIdAndDeletedAtIsNull(activeShare.get().getPostId()).orElse(null);
      if (existingPost != null && idempotencyKey.equals(existingPost.getIdempotencyKey())) {
        requireMatchingIdempotentFingerprint(activeShare.get(), publication.snapshotFingerprint());
        return existingPost;
      }
      throw new SocialException(
          HttpStatus.CONFLICT,
          "DUPLICATE_ACTIVE_TRIP_SHARE",
          "An active shared post already exists for this trip");
    }

    Instant now = Instant.now();
    UUID postId = UUID.randomUUID();
    UUID insertedId =
        posts.insertPostIfAbsent(
            postId,
            user.id(),
            authorName,
            user.email(),
            idempotencyKey,
            caption,
            "TRIP_SHARE",
            now,
            now);

    if (insertedId == null) {
      return posts
          .findByAuthorIdAndIdempotencyKey(user.id(), idempotencyKey)
          .orElseThrow(() -> new IllegalStateException("Idempotent post was not found"));
    }

    Instant capturedAt = Instant.now();
    String highlightsJson = writeHighlights(snapshot.summary().highlights());
    String payloadJson = writeSnapshot(snapshot);
    var exactDates =
        snapshot.days().stream()
            .map(PublicTripSnapshotClientResponse.Day::date)
            .filter(Objects::nonNull)
            .toList();
    SocialTripShare share =
        SocialTripShare.builder()
            .postId(postId)
            .authorId(user.id())
            .sourceTripId(sourceTripId)
            .visibility(visibility)
            .tripName(snapshot.summary().name())
            .destinationName(snapshot.summary().destinationName())
            .startDate(exactDates.isEmpty() ? null : exactDates.getFirst())
            .endDate(exactDates.isEmpty() ? null : exactDates.getLast())
            .coverImageUrl(snapshot.summary().coverImageUrl())
            .travelerCount(null)
            .dayCount(snapshot.summary().dayCount())
            .itineraryItemCount(snapshot.summary().itineraryItemCount())
            .highlightsJson(highlightsJson)
            .itineraryJson("[]")
            .snapshotCreatedAt(capturedAt)
            .currentSnapshotVersion(null)
            .detailAvailability("PUBLIC_SNAPSHOT")
            .datePrecision(snapshot.datePrecision())
            .publicationRevision(snapshot.publicationRevision())
            .createdAt(now)
            .updatedAt(now)
            .build();
    try {
      tripShares.saveAndFlush(share);
    } catch (DataIntegrityViolationException ex) {
      throw new SocialException(
          HttpStatus.CONFLICT,
          "DUPLICATE_ACTIVE_TRIP_SHARE",
          "An active shared post already exists for this trip");
    }

    snapshots.save(
        SocialTripShareSnapshot.builder()
            .postId(postId)
            .snapshotVersion(1)
            .schemaVersion((short) snapshot.schemaVersion())
            .sourcePublicationRevision(snapshot.publicationRevision())
            .payloadJson(payloadJson)
            .payloadSha256(publication.snapshotFingerprint())
            .capturedAt(capturedAt)
            .createdAt(now)
            .build());
    share.setCurrentSnapshotVersion(1);
    tripShares.save(share);

    return SocialPost.builder()
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
  }

  @Transactional
  public void refresh(
      UUID postId,
      AuthenticatedUser user,
      UUID idempotencyKey,
      TripPublicationClientResponse publication) {
    SocialTripShare share =
        tripShares
            .lockActiveByPostId(postId)
            .orElseThrow(
                () ->
                    new SocialException(
                        HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Trip share not found"));
    if (!share.getAuthorId().equals(user.id())) {
      throw new SocialException(
          HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the publication owner can refresh it");
    }
    var existingRefresh = snapshots.findByPostIdAndRefreshIdempotencyKey(postId, idempotencyKey);
    if (existingRefresh.isPresent()) {
      if (!Objects.equals(
          existingRefresh.get().getPayloadSha256(), publication.snapshotFingerprint())) {
        throw new SocialException(
            HttpStatus.CONFLICT,
            "IDEMPOTENCY_KEY_REUSED",
            "Idempotency key was already used for a different publication snapshot");
      }
      return;
    }
    int nextVersion = Optional.ofNullable(share.getCurrentSnapshotVersion()).orElse(0) + 1;
    PublicTripSnapshotClientResponse snapshot = publication.snapshot();
    Instant now = Instant.now();
    String payloadJson = writeSnapshot(snapshot);
    snapshots.save(
        SocialTripShareSnapshot.builder()
            .postId(postId)
            .snapshotVersion(nextVersion)
            .schemaVersion((short) snapshot.schemaVersion())
            .sourcePublicationRevision(snapshot.publicationRevision())
            .payloadJson(payloadJson)
            .payloadSha256(publication.snapshotFingerprint())
            .capturedAt(now)
            .createdAt(now)
            .refreshIdempotencyKey(idempotencyKey)
            .build());

    var exactDates =
        snapshot.days().stream()
            .map(PublicTripSnapshotClientResponse.Day::date)
            .filter(Objects::nonNull)
            .toList();
    share.setTripName(snapshot.summary().name());
    share.setDestinationName(snapshot.summary().destinationName());
    share.setCoverImageUrl(snapshot.summary().coverImageUrl());
    share.setStartDate(exactDates.isEmpty() ? null : exactDates.getFirst());
    share.setEndDate(exactDates.isEmpty() ? null : exactDates.getLast());
    share.setDayCount(snapshot.summary().dayCount());
    share.setItineraryItemCount(snapshot.summary().itineraryItemCount());
    share.setHighlightsJson(writeHighlights(snapshot.summary().highlights()));
    share.setCurrentSnapshotVersion(nextVersion);
    share.setDetailAvailability("PUBLIC_SNAPSHOT");
    share.setDatePrecision(snapshot.datePrecision());
    share.setPublicationRevision(snapshot.publicationRevision());
    share.setSnapshotCreatedAt(now);
    share.setUpdatedAt(now);
    tripShares.save(share);
  }

  private String writeHighlights(List<PublicTripSnapshotClientResponse.Highlight> highlights) {
    if (highlights == null || highlights.isEmpty()) {
      return "[]";
    }
    try {
      return objectMapper.writeValueAsString(highlights.stream().limit(3).toList());
    } catch (Exception ex) {
      throw new SocialException(
          HttpStatus.BAD_GATEWAY,
          "INVALID_TRIP_SNAPSHOT",
          "Trip service returned an invalid public snapshot");
    }
  }

  private String writeSnapshot(PublicTripSnapshotClientResponse snapshot) {
    try {
      byte[] payload = objectMapper.writeValueAsBytes(snapshot);
      if (payload.length > 512 * 1024) {
        throw new SocialException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            "PUBLICATION_LIMIT_EXCEEDED",
            "Public snapshot exceeds 512 KiB");
      }
      return new String(payload, java.nio.charset.StandardCharsets.UTF_8);
    } catch (SocialException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new SocialException(
          HttpStatus.BAD_GATEWAY,
          "INVALID_TRIP_SNAPSHOT",
          "Trip service returned an invalid public snapshot");
    }
  }

  private void requireMatchingIdempotentFingerprint(SocialTripShare share, String fingerprint) {
    if (share.getCurrentSnapshotVersion() == null) return;
    SocialTripShareSnapshot current =
        snapshots
            .findByPostIdAndSnapshotVersion(share.getPostId(), share.getCurrentSnapshotVersion())
            .orElse(null);
    if (current != null && !Objects.equals(current.getPayloadSha256(), fingerprint)) {
      throw new SocialException(
          HttpStatus.CONFLICT,
          "IDEMPOTENCY_KEY_REUSED",
          "Idempotency key was already used for a different publication snapshot");
    }
  }
}
