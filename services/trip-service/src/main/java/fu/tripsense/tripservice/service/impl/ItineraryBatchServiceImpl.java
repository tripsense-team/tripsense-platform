package fu.tripsense.tripservice.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.client.PlaceClient;
import fu.tripsense.tripservice.client.PlaceSnapshot;
import fu.tripsense.tripservice.dto.request.ItineraryBatchOperation;
import fu.tripsense.tripservice.dto.request.ItineraryBatchRequest;
import fu.tripsense.tripservice.dto.response.ItineraryBatchResponse;
import fu.tripsense.tripservice.entity.*;
import fu.tripsense.tripservice.enums.ItineraryItemStatus;
import fu.tripsense.tripservice.exception.ConflictException;
import fu.tripsense.tripservice.exception.NotFoundException;
import fu.tripsense.tripservice.exception.ValidationException;
import fu.tripsense.tripservice.repository.*;
import fu.tripsense.tripservice.service.ItineraryBatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ItineraryBatchServiceImpl implements ItineraryBatchService {
    private final TripRepository tripRepository;
    private final ItineraryDayRepository dayRepository;
    private final ItineraryItemRepository itemRepository;
    private final ItineraryCommitReceiptRepository receiptRepository;
    private final PlaceClient placeClient;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public ItineraryBatchResponse apply(UUID ownerUserId, UUID tripId, String idempotencyKey, ItineraryBatchRequest request) {
        String requestHash = hash(request);
        Optional<ItineraryCommitReceipt> prior = receiptRepository.findByOwnerUserIdAndIdempotencyKey(ownerUserId, idempotencyKey);
        if (prior.isPresent()) {
            ItineraryCommitReceipt receipt = prior.get();
            if (!receipt.getRequestHash().equals(requestHash)) {
                throw new ConflictException("IDEMPOTENCY_CONFLICT", "Idempotency key was reused with a different request");
            }
            return response(receipt, true);
        }

        Trip trip = tripRepository.findOwnedForUpdate(tripId, ownerUserId)
                .orElseThrow(() -> new NotFoundException("TRIP_NOT_FOUND", "Trip not found"));
        long revision = trip.getAggregateRevision() == null ? 0L : trip.getAggregateRevision();
        if (revision != request.expectedTripRevision()) {
            throw new ConflictException("TRIP_VERSION_CONFLICT", "Trip aggregate revision changed");
        }
        validateOperations(trip, request.operations());
        for (ItineraryBatchOperation operation : request.operations()) applyOperation(trip, operation);
        trip.setAggregateRevision(revision + 1);
        tripRepository.save(trip);

        Instant appliedAt = Instant.now();
        ItineraryCommitReceipt receipt = ItineraryCommitReceipt.builder()
                .ownerUserId(ownerUserId).tripId(tripId).proposalId(request.proposalId())
                .proposalHash(request.proposalHash()).idempotencyKey(idempotencyKey).requestHash(requestHash)
                .resultJson(Map.of("tripRevision", revision + 1, "appliedOperationCount", request.operations().size(),
                        "appliedAt", appliedAt.toString()))
                .createdAt(appliedAt).build();
        receiptRepository.save(receipt);
        return new ItineraryBatchResponse(receipt.getId(), tripId, request.proposalId(), revision + 1,
                request.operations().size(), appliedAt, false);
    }

    private void validateOperations(Trip trip, List<ItineraryBatchOperation> operations) {
        Set<UUID> dayIds = new HashSet<>();
        for (ItineraryBatchOperation operation : operations) {
            if (operation.type() == null) throw new ValidationException("INVALID_BATCH_OPERATION", "Operation type is required");
            if (operation.dayId() != null) {
                ItineraryDay day = dayRepository.findByIdAndTripIdForUpdate(operation.dayId(), trip.getId())
                        .orElseThrow(() -> new ValidationException("INVALID_BATCH_DAY", "Operation day is not part of the trip"));
                dayIds.add(day.getId());
            }
            if (("UPDATE".equals(operation.type()) || "DELETE".equals(operation.type())) && operation.itemId() == null) {
                throw new ValidationException("INVALID_BATCH_OPERATION", "itemId is required");
            }
            if (operation.startTime() != null && operation.endTime() != null && !operation.startTime().isBefore(operation.endTime())) {
                throw new ValidationException("INVALID_ITEM_TIME_RANGE", "startTime must be before endTime");
            }
        }
    }

    private void applyOperation(Trip trip, ItineraryBatchOperation operation) {
        switch (operation.type()) {
            case "ADD" -> add(trip, operation);
            case "UPDATE" -> update(trip, operation);
            case "DELETE" -> delete(trip, operation);
            case "REORDER" -> reorder(trip, operation);
            default -> throw new ValidationException("INVALID_BATCH_OPERATION", "Unsupported operation type");
        }
    }

    private void add(Trip trip, ItineraryBatchOperation operation) {
        if (operation.dayId() == null || operation.itemType() == null || operation.title() == null || operation.title().isBlank()) {
            throw new ValidationException("INVALID_BATCH_OPERATION", "ADD requires dayId, itemType and title");
        }
        PlaceSnapshot snapshot = operation.placeRef() == null ? null : placeClient.requireCanonicalPlace(operation.placeRef());
        int order = operation.sortOrder() != null ? operation.sortOrder()
                : itemRepository.maxSortOrderByTripIdAndDayId(trip.getId(), operation.dayId()) + 100;
        itemRepository.save(ItineraryItem.builder().tripId(trip.getId()).dayId(operation.dayId())
                .placeRef(operation.placeRef()).title(operation.title().trim()).type(operation.itemType())
                .startTime(operation.startTime()).endTime(operation.endTime()).durationMinutes(operation.durationMinutes())
                .sortOrder(order).status(operation.status() == null ? ItineraryItemStatus.PLANNED : operation.status())
                .notes(operation.notes()).placeNameSnapshot(snapshot == null ? null : snapshot.name())
                .placeAddressSnapshot(snapshot == null ? null : snapshot.address())
                .latSnapshot(snapshot == null ? null : snapshot.latitude()).lngSnapshot(snapshot == null ? null : snapshot.longitude())
                .build());
    }

    private void update(Trip trip, ItineraryBatchOperation operation) {
        ItineraryItem item = itemRepository.findByIdAndTripIdForUpdate(operation.itemId(), trip.getId())
                .orElseThrow(() -> new ValidationException("INVALID_BATCH_ITEM", "Item is not part of the trip"));
        if (operation.expectedItemVersion() != null && !operation.expectedItemVersion().equals(item.getVersion())) {
            throw new ConflictException("ITEM_VERSION_CONFLICT", "Itinerary item changed");
        }
        if (operation.placeRef() != null && !operation.placeRef().equals(item.getPlaceRef())) {
            PlaceSnapshot snapshot = placeClient.requireCanonicalPlace(operation.placeRef());
            item.setPlaceRef(operation.placeRef());
            item.setPlaceNameSnapshot(snapshot == null ? null : snapshot.name());
            item.setPlaceAddressSnapshot(snapshot == null ? null : snapshot.address());
            item.setLatSnapshot(snapshot == null ? null : snapshot.latitude());
            item.setLngSnapshot(snapshot == null ? null : snapshot.longitude());
        }
        if (operation.title() != null && !operation.title().isBlank()) item.setTitle(operation.title().trim());
        if (operation.itemType() != null) item.setType(operation.itemType());
        if (operation.startTime() != null) item.setStartTime(operation.startTime());
        if (operation.endTime() != null) item.setEndTime(operation.endTime());
        if (operation.durationMinutes() != null) item.setDurationMinutes(operation.durationMinutes());
        if (operation.status() != null) item.setStatus(operation.status());
        if (operation.notes() != null) item.setNotes(operation.notes());
        itemRepository.save(item);
    }

    private void delete(Trip trip, ItineraryBatchOperation operation) {
        ItineraryItem item = itemRepository.findByIdAndTripIdForUpdate(operation.itemId(), trip.getId())
                .orElseThrow(() -> new ValidationException("INVALID_BATCH_ITEM", "Item is not part of the trip"));
        if (operation.expectedItemVersion() != null && !operation.expectedItemVersion().equals(item.getVersion())) {
            throw new ConflictException("ITEM_VERSION_CONFLICT", "Itinerary item changed");
        }
        itemRepository.delete(item);
    }

    private void reorder(Trip trip, ItineraryBatchOperation operation) {
        if (operation.dayId() == null || operation.orderedItemIds() == null) {
            throw new ValidationException("INVALID_BATCH_OPERATION", "REORDER requires dayId and orderedItemIds");
        }
        List<ItineraryItem> items = itemRepository.findByTripIdAndDayIdForUpdate(trip.getId(), operation.dayId());
        Set<UUID> current = items.stream().map(ItineraryItem::getId).collect(java.util.stream.Collectors.toSet());
        if (operation.orderedItemIds().size() != current.size() || !current.equals(new HashSet<>(operation.orderedItemIds()))) {
            throw new ValidationException("INVALID_REORDER_PAYLOAD", "Reorder must contain exactly the current day items");
        }
        Map<UUID, ItineraryItem> byId = new HashMap<>();
        items.forEach(item -> byId.put(item.getId(), item));
        for (int i = 0; i < operation.orderedItemIds().size(); i++) byId.get(operation.orderedItemIds().get(i)).setSortOrder(-(i + 1));
        itemRepository.saveAllAndFlush(items);
        for (int i = 0; i < operation.orderedItemIds().size(); i++) byId.get(operation.orderedItemIds().get(i)).setSortOrder((i + 1) * 100);
        itemRepository.saveAll(items);
    }

    private String hash(ItineraryBatchRequest request) {
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(request);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (JsonProcessingException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Cannot hash batch request", exception);
        }
    }

    private ItineraryBatchResponse response(ItineraryCommitReceipt receipt, boolean replayed) {
        Map<String, Object> result = receipt.getResultJson();
        return new ItineraryBatchResponse(receipt.getId(), receipt.getTripId(), receipt.getProposalId(),
                ((Number) result.get("tripRevision")).longValue(), ((Number) result.get("appliedOperationCount")).intValue(),
                Instant.parse(String.valueOf(result.get("appliedAt"))), replayed);
    }
}
