package fu.tripsense.tripservice.service.impl;

import fu.tripsense.tripservice.client.CommunityTripImportProjection;
import fu.tripsense.tripservice.dto.request.ImportCommunityTripRequest;
import fu.tripsense.tripservice.dto.response.ImportedTripResponse;
import fu.tripsense.tripservice.entity.*;
import fu.tripsense.tripservice.enums.*;
import fu.tripsense.tripservice.exception.ConflictException;
import fu.tripsense.tripservice.repository.*;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class CommunityTripImportWriter {
  private final TripRepository trips;
  private final ItineraryDayRepository days;
  private final ItineraryItemRepository items;
  private final TripMemberRepository members;
  private final TripCommunityImportReceiptRepository receipts;

  @Transactional
  public ImportedTripResponse write(
      UUID userId,
      UUID postId,
      UUID idempotencyKey,
      String requestFingerprint,
      ImportCommunityTripRequest request,
      CommunityTripImportProjection projection) {
    var existing = receipts.findByUserIdAndIdempotencyKey(userId, idempotencyKey);
    if (existing.isPresent()) {
      if (!existing.get().getRequestFingerprint().equals(requestFingerprint)) {
        throw new ConflictException(
            "IDEMPOTENCY_KEY_CONFLICT", "Idempotency key was used for another import request");
      }
      return response(existing.get());
    }

    var summary = projection.snapshot().summary();
    Instant now = Instant.now();
    Trip trip =
        trips.save(
            Trip.builder()
                .ownerUserId(userId)
                .name(request.name().trim())
                .destinationName(summary.destinationName().trim())
                .startDate(request.startDate())
                .endDate(request.endDate())
                .status(TripStatus.DRAFT)
                .coverImageUrl(summary.coverImageUrl())
                .visibility("PRIVATE")
                .build());
    members.save(
        TripMember.builder()
            .trip(trip)
            .userId(userId)
            .role(TripMemberRole.OWNER)
            .joinedAt(now)
            .build());

    List<ItineraryDay> createdDays = new ArrayList<>();
    for (int dayIndex = 0; dayIndex < projection.snapshot().days().size(); dayIndex++) {
      createdDays.add(
          ItineraryDay.builder()
              .tripId(trip.getId())
              .dayDate(request.startDate().plusDays(dayIndex))
              .dayNumber(dayIndex + 1)
              .build());
    }
    createdDays = days.saveAll(createdDays);

    List<ItineraryItem> createdItems = new ArrayList<>();
    for (int dayIndex = 0; dayIndex < projection.snapshot().days().size(); dayIndex++) {
      var sourceDay = projection.snapshot().days().get(dayIndex);
      ItineraryDay targetDay = createdDays.get(dayIndex);
      for (var sourceItem : sourceDay.items()) {
        createdItems.add(
            ItineraryItem.builder()
                .tripId(trip.getId())
                .dayId(targetDay.getId())
                .title(sourceItem.title().trim())
                .type(ItineraryItemType.valueOf(sourceItem.type()))
                .durationMinutes(sourceItem.durationMinutes())
                .sortOrder(sourceItem.order() * 1000)
                .status(ItineraryItemStatus.PLANNED)
                .placeNameSnapshot(normalize(sourceItem.placeName()))
                .sourceKind("COMMUNITY_IMPORT")
                .build());
      }
    }
    items.saveAll(createdItems);

    TripCommunityImportReceipt receipt =
        receipts.saveAndFlush(
            TripCommunityImportReceipt.builder()
                .userId(userId)
                .idempotencyKey(idempotencyKey)
                .requestFingerprint(requestFingerprint)
                .sourcePostId(postId)
                .sourceSnapshotSha256(projection.payloadSha256())
                .destinationTripId(trip.getId())
                .importedDayCount(createdDays.size())
                .importedItemCount(createdItems.size())
                .createdAt(now)
                .build());
    return response(receipt, trip.getName());
  }

  @Transactional(readOnly = true)
  public ImportedTripResponse response(TripCommunityImportReceipt receipt) {
    String name =
        trips.findById(receipt.getDestinationTripId()).map(Trip::getName).orElse("Imported trip");
    return response(receipt, name);
  }

  private ImportedTripResponse response(TripCommunityImportReceipt receipt, String name) {
    return new ImportedTripResponse(
        receipt.getDestinationTripId(),
        receipt.getSourcePostId(),
        name,
        receipt.getImportedDayCount(),
        receipt.getImportedItemCount(),
        receipt.getCreatedAt());
  }

  private String normalize(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
