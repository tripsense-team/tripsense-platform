package fu.tripsense.tripservice.service;

import fu.tripsense.tripservice.client.PlaceClient;
import fu.tripsense.tripservice.client.PlaceSnapshot;
import fu.tripsense.tripservice.dto.request.*;
import fu.tripsense.tripservice.dto.response.*;
import fu.tripsense.tripservice.entity.ItineraryDay;
import fu.tripsense.tripservice.entity.ItineraryItem;
import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.enums.*;
import fu.tripsense.tripservice.exception.ConflictException;
import fu.tripsense.tripservice.exception.NotFoundException;
import fu.tripsense.tripservice.exception.ValidationException;
import fu.tripsense.tripservice.repository.ItineraryDayRepository;
import fu.tripsense.tripservice.repository.ItineraryItemRepository;
import fu.tripsense.tripservice.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TripService {

    private static final int MAX_TRIP_DAYS = 60;
    private static final int SORT_ORDER_STEP = 1000;

    private final TripRepository tripRepository;
    private final ItineraryDayRepository dayRepository;
    private final ItineraryItemRepository itemRepository;
    private final PlaceClient placeClient;

    @Transactional
    @CacheEvict(cacheNames = {"trip-list"}, allEntries = true)
    public TripResponse createTrip(UUID userId, CreateTripRequest request) {
        validateDateRange(request.startDate(), request.endDate());

        Trip trip = Trip.builder()
                .ownerUserId(userId)
                .name(request.name().trim())
                .destinationName(request.destinationName().trim())
                .destinationPlaceId(request.destinationPlaceId())
                .startDate(request.startDate())
                .endDate(request.endDate())
                .status(TripStatus.DRAFT)
                .travelerCount(request.travelerCount())
                .budgetAmount(request.budgetAmount())
                .budgetCurrency(request.budgetCurrency())
                .notes(normalize(request.notes()))
                .coverImageUrl(normalize(request.coverImageUrl()))
                .build();

        Trip saved = tripRepository.save(trip);
        generateMissingDays(saved);
        return toTripResponse(saved);
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "trip-list", key = "#userId + ':' + #status + ':' + #from + ':' + #to + ':' + #page + ':' + #size")
    public TripListResponse listTrips(UUID userId, TripStatus status, LocalDate from, LocalDate to, int page, int size) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new ValidationException("INVALID_TRIP_DATE_RANGE", "from must be on or before to");
        }

        PageRequest pageRequest = PageRequest.of(page, Math.min(size, 100), Sort.by("startDate").ascending());
        Specification<Trip> specification = (root, query, criteriaBuilder) ->
                criteriaBuilder.and(
                        criteriaBuilder.equal(root.get("ownerUserId"), userId),
                        criteriaBuilder.isNull(root.get("archivedAt")),
                        status == null ? criteriaBuilder.conjunction() : criteriaBuilder.equal(root.get("status"), status),
                        from == null ? criteriaBuilder.conjunction() : criteriaBuilder.greaterThanOrEqualTo(root.get("endDate"), from),
                        to == null ? criteriaBuilder.conjunction() : criteriaBuilder.lessThanOrEqualTo(root.get("startDate"), to)
                );
        Page<Trip> trips = tripRepository.findAll(specification, pageRequest);

        return new TripListResponse(
                trips.getContent().stream().map(this::toTripResponse).toList(),
                trips.getNumber(),
                trips.getSize(),
                trips.getTotalElements(),
                trips.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "trip-detail", key = "#userId + ':' + #tripId")
    public TripResponse getTrip(UUID userId, UUID tripId) {
        return toTripResponse(getOwnedTrip(userId, tripId));
    }

    @Transactional
    @CacheEvict(cacheNames = {"trip-detail", "trip-list", "trip-itinerary"}, allEntries = true)
    public TripResponse updateTrip(UUID userId, UUID tripId, UpdateTripRequest request) {
        Trip trip = getOwnedTrip(userId, tripId);
        ensureNotArchived(trip);

        LocalDate nextStart = request.startDate() != null ? request.startDate() : trip.getStartDate();
        LocalDate nextEnd = request.endDate() != null ? request.endDate() : trip.getEndDate();
        validateDateRange(nextStart, nextEnd);

        boolean datesChanged = !nextStart.equals(trip.getStartDate()) || !nextEnd.equals(trip.getEndDate());
        if (datesChanged) {
            blockDateShrinkWithItems(trip, nextStart, nextEnd);
            trip.setStartDate(nextStart);
            trip.setEndDate(nextEnd);
            reconcileDays(trip);
        }

        if (request.name() != null && !request.name().isBlank()) {
            trip.setName(request.name().trim());
        }
        if (request.destinationName() != null && !request.destinationName().isBlank()) {
            trip.setDestinationName(request.destinationName().trim());
        }
        if (request.destinationPlaceId() != null) {
            trip.setDestinationPlaceId(request.destinationPlaceId());
        }
        if (request.status() != null) {
            validateStatusChange(trip.getStatus(), request.status());
            trip.setStatus(request.status());
            if (request.status() == TripStatus.ARCHIVED) {
                trip.setArchivedAt(Instant.now());
            }
        }
        if (request.travelerCount() != null) {
            trip.setTravelerCount(request.travelerCount());
        }
        if (request.budgetAmount() != null) {
            trip.setBudgetAmount(request.budgetAmount());
        }
        if (request.budgetCurrency() != null) {
            trip.setBudgetCurrency(request.budgetCurrency());
        }
        if (request.notes() != null) {
            trip.setNotes(normalize(request.notes()));
        }
        if (request.coverImageUrl() != null) {
            trip.setCoverImageUrl(normalize(request.coverImageUrl()));
        }

        return toTripResponse(tripRepository.save(trip));
    }

    @Transactional
    @CacheEvict(cacheNames = {"trip-detail", "trip-list", "trip-itinerary"}, allEntries = true)
    public void archiveTrip(UUID userId, UUID tripId) {
        Trip trip = getOwnedTrip(userId, tripId);
        trip.setStatus(TripStatus.ARCHIVED);
        trip.setArchivedAt(Instant.now());
        tripRepository.save(trip);
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "trip-itinerary", key = "#userId + ':' + #tripId")
    public ItineraryResponse getItinerary(UUID userId, UUID tripId) {
        Trip trip = getOwnedTrip(userId, tripId);
        List<ItineraryDay> days = dayRepository.findByTripIdOrderByDayNumberAsc(trip.getId());
        return new ItineraryResponse(
                trip.getId(),
                days.stream().map(day -> toDayResponse(day, itemRepository.findByTripIdAndDayIdOrderBySortOrderAsc(trip.getId(), day.getId()))).toList()
        );
    }

    @Transactional(readOnly = true)
    public ItineraryDayResponse getItineraryDay(UUID userId, UUID tripId, UUID dayId) {
        Trip trip = getOwnedTrip(userId, tripId);
        ItineraryDay day = getTripDay(trip.getId(), dayId);
        return toDayResponse(day, itemRepository.findByTripIdAndDayIdOrderBySortOrderAsc(trip.getId(), day.getId()));
    }

    @Transactional
    @CacheEvict(cacheNames = {"trip-detail", "trip-list", "trip-itinerary"}, allEntries = true)
    public ItineraryItemResponse createItem(UUID userId, UUID tripId, UUID dayId, CreateItineraryItemRequest request) {
        Trip trip = getOwnedTrip(userId, tripId);
        ensureNotArchived(trip);
        ItineraryDay day = getTripDay(trip.getId(), dayId);
        validateTimeRange(request.startTime(), request.endTime());

        PlaceSnapshot snapshot = request.placeId() == null ? null : placeClient.validatePlace(request.placeId());
        int sortOrder = itemRepository.maxSortOrderByTripIdAndDayId(trip.getId(), day.getId()) + SORT_ORDER_STEP;

        ItineraryItem item = ItineraryItem.builder()
                .tripId(trip.getId())
                .dayId(day.getId())
                .placeId(request.placeId())
                .type(request.type())
                .title(request.title().trim())
                .startTime(request.startTime())
                .endTime(request.endTime())
                .durationMinutes(request.durationMinutes())
                .sortOrder(sortOrder)
                .status(ItineraryItemStatus.PLANNED)
                .notes(normalize(request.notes()))
                .placeNameSnapshot(snapshot == null ? null : snapshot.name())
                .placeAddressSnapshot(snapshot == null ? null : snapshot.address())
                .latSnapshot(snapshot == null ? null : snapshot.latitude())
                .lngSnapshot(snapshot == null ? null : snapshot.longitude())
                .build();

        ItineraryItem saved = itemRepository.save(item);
        List<ItineraryItem> dayItems = itemRepository.findByTripIdAndDayIdOrderBySortOrderAsc(trip.getId(), day.getId());
        return toItemResponse(saved, overlapWarnings(saved, dayItems));
    }

    @Transactional
    @CacheEvict(cacheNames = {"trip-detail", "trip-list", "trip-itinerary"}, allEntries = true)
    public ItineraryItemResponse updateItem(UUID userId, UUID tripId, UUID itemId, UpdateItineraryItemRequest request) {
        Trip trip = getOwnedTrip(userId, tripId);
        ensureNotArchived(trip);
        ItineraryItem item = itemRepository.findByIdAndTripId(itemId, trip.getId())
                .orElseThrow(() -> new NotFoundException("ITINERARY_ITEM_NOT_FOUND", "Itinerary item not found"));

        LocalTime nextStart = request.startTime() != null ? request.startTime() : item.getStartTime();
        LocalTime nextEnd = request.endTime() != null ? request.endTime() : item.getEndTime();
        validateTimeRange(nextStart, nextEnd);

        if (request.placeId() != null && !request.placeId().equals(item.getPlaceId())) {
            PlaceSnapshot snapshot = placeClient.validatePlace(request.placeId());
            item.setPlaceId(request.placeId());
            item.setPlaceNameSnapshot(snapshot.name());
            item.setPlaceAddressSnapshot(snapshot.address());
            item.setLatSnapshot(snapshot.latitude());
            item.setLngSnapshot(snapshot.longitude());
        }
        if (request.type() != null) {
            item.setType(request.type());
        }
        if (request.title() != null && !request.title().isBlank()) {
            item.setTitle(request.title().trim());
        }
        item.setStartTime(nextStart);
        item.setEndTime(nextEnd);
        if (request.durationMinutes() != null) {
            item.setDurationMinutes(request.durationMinutes());
        }
        if (request.status() != null) {
            item.setStatus(request.status());
        }
        if (request.notes() != null) {
            item.setNotes(normalize(request.notes()));
        }

        ItineraryItem saved = itemRepository.save(item);
        List<ItineraryItem> dayItems = itemRepository.findByTripIdAndDayIdOrderBySortOrderAsc(trip.getId(), saved.getDayId());
        return toItemResponse(saved, overlapWarnings(saved, dayItems));
    }

    @Transactional
    @CacheEvict(cacheNames = {"trip-detail", "trip-list", "trip-itinerary"}, allEntries = true)
    public void deleteItem(UUID userId, UUID tripId, UUID itemId) {
        Trip trip = getOwnedTrip(userId, tripId);
        ensureNotArchived(trip);
        itemRepository.findByIdAndTripId(itemId, trip.getId())
                .ifPresent(itemRepository::delete);
    }

    @Transactional
    @CacheEvict(cacheNames = {"trip-detail", "trip-list", "trip-itinerary"}, allEntries = true)
    public ItineraryDayResponse reorderItems(UUID userId, UUID tripId, UUID dayId, ReorderItemsRequest request) {
        Trip trip = getOwnedTrip(userId, tripId);
        ensureNotArchived(trip);
        ItineraryDay day = dayRepository.findByIdAndTripIdForUpdate(dayId, trip.getId())
                .orElseThrow(() -> new NotFoundException("ITINERARY_DAY_NOT_FOUND", "Itinerary day not found"));

        List<ItineraryItem> items = itemRepository.findByTripIdAndDayIdForUpdate(trip.getId(), day.getId());
        Set<UUID> existingIds = items.stream().map(ItineraryItem::getId).collect(Collectors.toSet());
        Set<UUID> requestedIds = new LinkedHashSet<>(request.orderedItemIds());
        if (requestedIds.size() != request.orderedItemIds().size() || !existingIds.equals(requestedIds)) {
            throw new ValidationException("INVALID_REORDER_PAYLOAD", "Reorder payload must contain exactly the current day item IDs");
        }

        List<TimeSlot> timeSlots = items.stream()
                .map(item -> new TimeSlot(item.getStartTime(), item.getEndTime()))
                .sorted(Comparator.comparing(TimeSlot::startTime, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        Map<UUID, ItineraryItem> byId = items.stream().collect(Collectors.toMap(ItineraryItem::getId, Function.identity()));
        for (int i = 0; i < request.orderedItemIds().size(); i++) {
            byId.get(request.orderedItemIds().get(i)).setSortOrder(-(i + 1));
        }
        itemRepository.saveAllAndFlush(items);

        for (int i = 0; i < request.orderedItemIds().size(); i++) {
            ItineraryItem item = byId.get(request.orderedItemIds().get(i));
            TimeSlot timeSlot = timeSlots.get(i);
            item.setSortOrder((i + 1) * SORT_ORDER_STEP);
            item.setStartTime(timeSlot.startTime());
            item.setEndTime(timeSlot.endTime());
        }
        List<ItineraryItem> saved = itemRepository.saveAll(items);
        day.setUpdatedAt(Instant.now());
        dayRepository.save(day);

        return toDayResponse(day, saved.stream().sorted(Comparator.comparing(ItineraryItem::getSortOrder)).toList());
    }

    private record TimeSlot(LocalTime startTime, LocalTime endTime) {
    }

    private Trip getOwnedTrip(UUID userId, UUID tripId) {
        return tripRepository.findByIdAndOwnerUserIdAndArchivedAtIsNull(tripId, userId)
                .orElseThrow(() -> new NotFoundException("TRIP_NOT_FOUND", "Trip not found"));
    }

    private ItineraryDay getTripDay(UUID tripId, UUID dayId) {
        return dayRepository.findByIdAndTripId(dayId, tripId)
                .orElseThrow(() -> new NotFoundException("ITINERARY_DAY_NOT_FOUND", "Itinerary day not found"));
    }

    private void validateDateRange(LocalDate startDate, LocalDate endDate) {
        if (startDate.isBefore(LocalDate.now())) {
            throw new ValidationException("INVALID_TRIP_DATE_RANGE", "startDate cannot be in the past");
        }
        if (!endDate.isAfter(startDate)) {
            throw new ValidationException("INVALID_TRIP_DATE_RANGE", "endDate must be after startDate");
        }
        long days = ChronoUnit.DAYS.between(startDate, endDate) + 1;
        if (days > MAX_TRIP_DAYS) {
            throw new ValidationException("INVALID_TRIP_DATE_RANGE", "Trip duration cannot exceed " + MAX_TRIP_DAYS + " days");
        }
    }

    private void validateTimeRange(LocalTime startTime, LocalTime endTime) {
        if (startTime != null && endTime != null && !startTime.isBefore(endTime)) {
            throw new ValidationException("INVALID_ITEM_TIME_RANGE", "startTime must be before endTime");
        }
    }

    private void validateStatusChange(TripStatus current, TripStatus next) {
        if (current == TripStatus.ARCHIVED && next != TripStatus.ARCHIVED) {
            throw new ValidationException("VALIDATION_FAILED", "Archived trips cannot change status");
        }
    }

    private void ensureNotArchived(Trip trip) {
        if (trip.getStatus() == TripStatus.ARCHIVED || trip.getArchivedAt() != null) {
            throw new NotFoundException("TRIP_NOT_FOUND", "Trip not found");
        }
    }

    private void blockDateShrinkWithItems(Trip trip, LocalDate nextStart, LocalDate nextEnd) {
        List<ItineraryDay> outsideDays = dayRepository.findByTripIdAndDayDateBeforeOrTripIdAndDayDateAfter(
                trip.getId(), nextStart, trip.getId(), nextEnd);
        if (!outsideDays.isEmpty()) {
            List<UUID> outsideDayIds = outsideDays.stream().map(ItineraryDay::getId).toList();
            if (itemRepository.existsByTripIdAndDayIdIn(trip.getId(), outsideDayIds)) {
                throw new ValidationException("DATE_CHANGE_BLOCKED", "Trip date change would move existing itinerary items outside the trip range");
            }
        }
    }

    private void reconcileDays(Trip trip) {
        List<ItineraryDay> existingInRange = dayRepository.findByTripIdAndDayDateBetween(trip.getId(), trip.getStartDate(), trip.getEndDate());
        Map<LocalDate, ItineraryDay> byDate = existingInRange.stream().collect(Collectors.toMap(ItineraryDay::getDayDate, Function.identity()));

        List<ItineraryDay> toSave = new ArrayList<>();
        LocalDate cursor = trip.getStartDate();
        int dayNumber = 1;
        while (!cursor.isAfter(trip.getEndDate())) {
            ItineraryDay day = byDate.get(cursor);
            if (day == null) {
                day = ItineraryDay.builder().tripId(trip.getId()).dayDate(cursor).build();
            }
            day.setDayNumber(dayNumber++);
            toSave.add(day);
            cursor = cursor.plusDays(1);
        }
        dayRepository.saveAll(toSave);

        List<ItineraryDay> outsideDays = dayRepository.findByTripIdAndDayDateBeforeOrTripIdAndDayDateAfter(
                trip.getId(), trip.getStartDate(), trip.getId(), trip.getEndDate());
        if (!outsideDays.isEmpty()) {
            dayRepository.deleteByTripIdAndIdIn(trip.getId(), outsideDays.stream().map(ItineraryDay::getId).toList());
        }
    }

    private void generateMissingDays(Trip trip) {
        LocalDate cursor = trip.getStartDate();
        int dayNumber = 1;
        List<ItineraryDay> days = new ArrayList<>();
        while (!cursor.isAfter(trip.getEndDate())) {
            if (!dayRepository.existsByTripIdAndDayDate(trip.getId(), cursor)) {
                days.add(ItineraryDay.builder()
                        .tripId(trip.getId())
                        .dayDate(cursor)
                        .dayNumber(dayNumber)
                        .build());
            }
            cursor = cursor.plusDays(1);
            dayNumber++;
        }
        dayRepository.saveAll(days);
    }

    private TripResponse toTripResponse(Trip trip) {
        return new TripResponse(
                trip.getId(),
                trip.getName(),
                trip.getDestinationName(),
                trip.getDestinationPlaceId(),
                trip.getStartDate(),
                trip.getEndDate(),
                trip.getStatus(),
                displayStatus(trip),
                trip.getOwnerUserId(),
                trip.getTravelerCount(),
                trip.getBudgetAmount(),
                trip.getBudgetCurrency(),
                trip.getNotes(),
                trip.getCoverImageUrl(),
                trip.getVersion(),
                trip.getCreatedAt(),
                trip.getUpdatedAt()
        );
    }

    private ItineraryDayResponse toDayResponse(ItineraryDay day, List<ItineraryItem> items) {
        return new ItineraryDayResponse(
                day.getId(),
                day.getDayDate(),
                day.getDayNumber(),
                day.getVersion(),
                items.stream().map(item -> toItemResponse(item, overlapWarnings(item, items))).toList()
        );
    }

    private ItineraryItemResponse toItemResponse(ItineraryItem item, List<String> warnings) {
        return new ItineraryItemResponse(
                item.getId(),
                item.getDayId(),
                item.getPlaceId(),
                item.getTitle(),
                item.getType(),
                item.getStartTime(),
                item.getEndTime(),
                item.getDurationMinutes(),
                item.getSortOrder(),
                item.getStatus(),
                item.getNotes(),
                item.getPlaceNameSnapshot(),
                item.getPlaceAddressSnapshot(),
                item.getLatSnapshot(),
                item.getLngSnapshot(),
                item.getVersion(),
                warnings
        );
    }

    private DisplayStatus displayStatus(Trip trip) {
        if (trip.getStatus() == TripStatus.ARCHIVED) {
            return DisplayStatus.ARCHIVED;
        }
        if (trip.getStatus() == TripStatus.CANCELLED) {
            return DisplayStatus.CANCELLED;
        }
        if (trip.getStatus() == TripStatus.DRAFT) {
            return DisplayStatus.DRAFT;
        }
        LocalDate today = LocalDate.now();
        if (today.isBefore(trip.getStartDate())) {
            return DisplayStatus.UPCOMING;
        }
        if (today.isAfter(trip.getEndDate())) {
            return DisplayStatus.COMPLETED;
        }
        return DisplayStatus.ONGOING;
    }

    private List<String> overlapWarnings(ItineraryItem item, List<ItineraryItem> dayItems) {
        if (item.getStartTime() == null || item.getEndTime() == null) {
            return List.of();
        }
        boolean overlaps = dayItems.stream()
                .filter(other -> !other.getId().equals(item.getId()))
                .filter(other -> other.getStartTime() != null && other.getEndTime() != null)
                .anyMatch(other -> item.getStartTime().isBefore(other.getEndTime()) && other.getStartTime().isBefore(item.getEndTime()));
        return overlaps ? List.of("TIME_OVERLAP") : List.of();
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
