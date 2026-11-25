package fu.tripsense.tripservice.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.client.PlaceClient;
import fu.tripsense.tripservice.client.PlaceSnapshot;
import fu.tripsense.tripservice.dto.request.AiItineraryCommitRequest;
import fu.tripsense.tripservice.dto.request.CreateTripRequest;
import fu.tripsense.tripservice.dto.response.AiItineraryCommitResponse;
import fu.tripsense.tripservice.dto.response.TripResponse;
import fu.tripsense.tripservice.entity.*;
import fu.tripsense.tripservice.enums.CollaborationChangeType;
import fu.tripsense.tripservice.enums.ItineraryItemStatus;
import fu.tripsense.tripservice.enums.TripMemberRole;
import fu.tripsense.tripservice.exception.ConflictException;
import fu.tripsense.tripservice.exception.ForbiddenException;
import fu.tripsense.tripservice.exception.NotFoundException;
import fu.tripsense.tripservice.exception.ValidationException;
import fu.tripsense.tripservice.repository.*;
import fu.tripsense.tripservice.service.AiItineraryCommitService;
import fu.tripsense.tripservice.service.CollaborationChangeService;
import fu.tripsense.tripservice.service.TripService;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AiItineraryCommitServiceImpl implements AiItineraryCommitService {
  private final TripService tripService;
  private final TripRepository tripRepository;
  private final TripMemberRepository memberRepository;
  private final ItineraryDayRepository dayRepository;
  private final ItineraryItemRepository itemRepository;
  private final ItineraryCommitReceiptRepository receiptRepository;
  private final PlaceClient placeClient;
  private final ObjectMapper objectMapper;
  private final CollaborationChangeService collaborationChangeService;

  @Override
  @Transactional
  @CacheEvict(
      cacheNames = {"trip-detail", "trip-list", "trip-itinerary"},
      allEntries = true)
  public AiItineraryCommitResponse commit(
      UUID userId, String idempotencyKey, String requestHash, AiItineraryCommitRequest request) {
    validateActionPayload(request);
    Optional<ItineraryCommitReceipt> existingReceipt =
        receiptRepository.findByOwnerUserIdAndIdempotencyKey(userId, idempotencyKey);
    if (existingReceipt.isPresent()) {
      ItineraryCommitReceipt receipt = existingReceipt.get();
      if (!receipt.getRequestHash().equals(requestHash)) {
        throw new ConflictException(
            "IDEMPOTENCY_CONFLICT", "Idempotency key was reused with a different request");
      }
      AiItineraryCommitResponse prior =
          objectMapper.convertValue(receipt.getResultJson(), AiItineraryCommitResponse.class);
      return new AiItineraryCommitResponse(
          prior.operationId(),
          prior.status(),
          prior.action(),
          prior.tripId(),
          prior.tripName(),
          prior.tripRevision(),
          prior.appliedCount(),
          prior.skippedCount(),
          prior.items(),
          true);
    }

    Trip trip = resolveTrip(userId, request);
    long currentRevision = Optional.ofNullable(trip.getAggregateRevision()).orElse(0L);
    if (request.expectedTripRevision() != null
        && !request.expectedTripRevision().equals(currentRevision)) {
      throw new ConflictException("TRIP_VERSION_CONFLICT", "Trip aggregate revision changed");
    }

    Map<Integer, ItineraryDay> days = new HashMap<>();
    for (ItineraryDay day : dayRepository.findByTripIdOrderByDayNumberAsc(trip.getId())) {
      days.put(day.getDayNumber(), day);
    }

    Set<Integer> replaceDayNumberSet =
        request.replaceDayNumbers() == null
            ? Set.of()
            : new LinkedHashSet<>(request.replaceDayNumbers());
    if (request.action() == AiItineraryCommitRequest.Action.REPLACE_DAYS) {
      for (Integer dayNum : replaceDayNumberSet) {
        if (!days.containsKey(dayNum)) {
          throw new ValidationException(
              "INVALID_AI_COMMIT_DAY", "Replace day " + dayNum + " is outside the trip date range");
        }
      }
    }

    // Pre-validate every item and resolve canonical places before performing destructive deletes
    List<PlaceSnapshot> preResolvedSnapshots = new ArrayList<>(request.items().size());
    for (AiItineraryCommitRequest.Item requestedItem : request.items()) {
      ItineraryDay day = days.get(requestedItem.dayNumber());
      if (day == null) {
        throw new ValidationException(
            "INVALID_AI_COMMIT_DAY", "Proposal day is outside the trip date range");
      }
      if (request.action() == AiItineraryCommitRequest.Action.REPLACE_DAYS
          && !replaceDayNumberSet.contains(requestedItem.dayNumber())) {
        throw new ValidationException(
            "INVALID_AI_COMMIT_DAY",
            "Item day " + requestedItem.dayNumber() + " is not in replaceDayNumbers");
      }
      if (requestedItem.startTime() != null
          && requestedItem.endTime() != null
          && !requestedItem.startTime().isBefore(requestedItem.endTime())) {
        throw new ValidationException(
            "INVALID_ITEM_TIME_RANGE", "startTime must be before endTime");
      }
      preResolvedSnapshots.add(
          requestedItem.placeRef() == null
              ? null
              : placeClient.requireCanonicalPlace(requestedItem.placeRef()));
    }

    boolean isReplaceMode =
        request.action() == AiItineraryCommitRequest.Action.REPLACE_TRIP_ITEMS
            || request.action() == AiItineraryCommitRequest.Action.REPLACE_DAYS;

    if (request.action() == AiItineraryCommitRequest.Action.REPLACE_TRIP_ITEMS) {
      itemRepository.deleteByTripId(trip.getId());
      itemRepository.flush();
    } else if (request.action() == AiItineraryCommitRequest.Action.REPLACE_DAYS) {
      List<UUID> targetDayIds =
          replaceDayNumberSet.stream().map(dayNum -> days.get(dayNum).getId()).toList();
      itemRepository.deleteByTripIdAndDayIdIn(trip.getId(), targetDayIds);
      itemRepository.flush();
    }

    Map<UUID, Integer> sortOrderByDayId = new HashMap<>();
    List<AiItineraryCommitResponse.ItemResult> itemResults = new ArrayList<>();
    int appliedCount = 0;
    int skippedCount = 0;
    for (int i = 0; i < request.items().size(); i++) {
      AiItineraryCommitRequest.Item requestedItem = request.items().get(i);
      ItineraryDay day = days.get(requestedItem.dayNumber());

      if (!isReplaceMode) {
        Optional<ItineraryItem> duplicate =
            itemRepository.findByTripIdAndSourceProposalIdAndSourceItemKey(
                trip.getId(), request.proposalId(), requestedItem.sourceItemKey());
        if (duplicate.isPresent()) {
          skippedCount++;
          itemResults.add(
              new AiItineraryCommitResponse.ItemResult(
                  requestedItem.sourceItemKey(), duplicate.get().getId(), "SKIPPED_DUPLICATE"));
          continue;
        }
        if (request.action() == AiItineraryCommitRequest.Action.ADD_TO_TRIP
            && requestedItem.placeRef() != null) {
          Optional<ItineraryItem> existingSamePlace =
              itemRepository.findFirstByTripIdAndDayIdAndPlaceRef(
                  trip.getId(), day.getId(), requestedItem.placeRef());
          if (existingSamePlace.isPresent()) {
            skippedCount++;
            itemResults.add(
                new AiItineraryCommitResponse.ItemResult(
                    requestedItem.sourceItemKey(),
                    existingSamePlace.get().getId(),
                    "SKIPPED_DUPLICATE"));
            continue;
          }
        }
      }

      PlaceSnapshot snapshot = preResolvedSnapshots.get(i);
      int nextSortOrder =
          sortOrderByDayId.compute(
              day.getId(),
              (k, current) -> {
                if (current != null) return current + 100;
                return isReplaceMode
                    ? 100
                    : itemRepository.maxSortOrderByTripIdAndDayId(trip.getId(), day.getId()) + 100;
              });

      ItineraryItem saved =
          itemRepository.save(
              ItineraryItem.builder()
                  .tripId(trip.getId())
                  .dayId(day.getId())
                  .placeRef(requestedItem.placeRef())
                  .sourceKind("AI_PROPOSAL")
                  .sourceProposalId(request.proposalId())
                  .sourceItemKey(requestedItem.sourceItemKey())
                  .title(requestedItem.title().trim())
                  .type(requestedItem.itemType())
                  .startTime(requestedItem.startTime())
                  .endTime(requestedItem.endTime())
                  .sortOrder(nextSortOrder)
                  .status(ItineraryItemStatus.PLANNED)
                  .notes(requestedItem.notes())
                  .placeNameSnapshot(snapshot == null ? null : snapshot.name())
                  .placeAddressSnapshot(snapshot == null ? null : snapshot.address())
                  .latSnapshot(snapshot == null ? null : snapshot.latitude())
                  .lngSnapshot(snapshot == null ? null : snapshot.longitude())
                  .build());
      appliedCount++;
      itemResults.add(
          new AiItineraryCommitResponse.ItemResult(
              requestedItem.sourceItemKey(), saved.getId(), "APPLIED"));
    }

    long nextRevision = currentRevision;
    if (appliedCount > 0 || isReplaceMode) {
      trip.setPublicationRevision(
          Optional.ofNullable(trip.getPublicationRevision()).orElse(0L) + 1);
      tripRepository.save(trip);
      if (collaborationChangeService != null) {
        CollaborationChangeEvent event =
            collaborationChangeService.record(
                trip,
                userId,
                CollaborationChangeType.ITEM_UPDATED,
                Map.of(
                    "action", request.action().name(),
                    "proposalId", request.proposalId().toString(),
                    "appliedCount", appliedCount));
        nextRevision =
            event != null && event.getRevision() != null
                ? event.getRevision()
                : currentRevision + 1;
      } else {
        nextRevision = currentRevision + 1;
        trip.setAggregateRevision(nextRevision);
        tripRepository.save(trip);
      }
    }

    UUID operationId = UUID.randomUUID();
    AiItineraryCommitResponse response =
        new AiItineraryCommitResponse(
            operationId,
            "APPLIED",
            request.action().name(),
            trip.getId(),
            trip.getName(),
            nextRevision,
            appliedCount,
            skippedCount,
            List.copyOf(itemResults),
            false);

    @SuppressWarnings("unchecked")
    Map<String, Object> responseJson = objectMapper.convertValue(response, Map.class);
    receiptRepository.save(
        ItineraryCommitReceipt.builder()
            .id(operationId)
            .ownerUserId(userId)
            .tripId(trip.getId())
            .proposalId(request.proposalId().toString())
            .proposalHash(request.proposalHash())
            .idempotencyKey(idempotencyKey)
            .requestHash(requestHash)
            .resultJson(responseJson)
            .createdAt(Instant.now())
            .build());
    return response;
  }

  private void validateActionPayload(AiItineraryCommitRequest request) {
    if (request.action() == AiItineraryCommitRequest.Action.CREATE_TRIP) {
      if (request.targetTripId() != null || request.tripDraft() == null) {
        throw new ValidationException(
            "INVALID_AI_COMMIT", "CREATE_TRIP requires tripDraft and no targetTripId");
      }
      return;
    }

    if (request.targetTripId() == null || request.tripDraft() != null) {
      throw new ValidationException(
          "INVALID_AI_COMMIT", request.action().name() + " requires targetTripId and no tripDraft");
    }
    if (request.action() == AiItineraryCommitRequest.Action.REPLACE_DAYS) {
      if (request.replaceDayNumbers() == null || request.replaceDayNumbers().isEmpty()) {
        throw new ValidationException(
            "INVALID_AI_COMMIT_DAYS", "REPLACE_DAYS requires non-empty replaceDayNumbers");
      }
      return;
    }
    if (request.items().isEmpty()) {
      throw new ValidationException(
          "INVALID_AI_COMMIT_ITEMS",
          request.action().name() + " requires at least one itinerary item");
    }
  }

  private Trip resolveTrip(UUID userId, AiItineraryCommitRequest request) {
    if (request.action() == AiItineraryCommitRequest.Action.CREATE_TRIP) {
      if (request.targetTripId() != null || request.tripDraft() == null) {
        throw new ValidationException(
            "INVALID_AI_COMMIT", "CREATE_TRIP requires tripDraft and no targetTripId");
      }
      AiItineraryCommitRequest.TripDraft draft = request.tripDraft();
      TripResponse created =
          tripService.createTrip(
              userId,
              new CreateTripRequest(
                  draft.name(),
                  draft.destinationName(),
                  null,
                  draft.startDate(),
                  draft.endDate(),
                  draft.travelerCount(),
                  draft.budgetAmount(),
                  draft.budgetCurrency(),
                  draft.notes(),
                  null));
      return tripRepository
          .findActiveByIdForUpdate(created.id())
          .orElseThrow(() -> new NotFoundException("TRIP_NOT_FOUND", "Trip not found"));
    }

    if (request.targetTripId() == null || request.tripDraft() != null) {
      throw new ValidationException(
          "INVALID_AI_COMMIT", request.action().name() + " requires targetTripId and no tripDraft");
    }
    Trip trip =
        tripRepository
            .findActiveByIdForUpdate(request.targetTripId())
            .orElseThrow(() -> new NotFoundException("TRIP_NOT_FOUND", "Trip not found"));
    if (trip.getOwnerUserId().equals(userId)) return trip;
    TripMember member =
        memberRepository
            .findByTripIdAndUserId(trip.getId(), userId)
            .orElseThrow(
                () ->
                    new ForbiddenException(
                        "PERMISSION_DENIED", "You do not have permission to edit this trip"));
    if (member.getRole() != TripMemberRole.OWNER && member.getRole() != TripMemberRole.EDITOR) {
      throw new ForbiddenException(
          "PERMISSION_DENIED", "You do not have permission to edit this trip");
    }
    return trip;
  }
}
