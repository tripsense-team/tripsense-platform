package fu.tripsense.tripservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.client.PlaceClient;
import fu.tripsense.tripservice.client.PlaceSnapshot;
import fu.tripsense.tripservice.dto.request.AiItineraryCommitRequest;
import fu.tripsense.tripservice.dto.response.TripResponse;
import fu.tripsense.tripservice.entity.CollaborationChangeEvent;
import fu.tripsense.tripservice.entity.ItineraryCommitReceipt;
import fu.tripsense.tripservice.entity.ItineraryDay;
import fu.tripsense.tripservice.entity.ItineraryItem;
import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.enums.DisplayStatus;
import fu.tripsense.tripservice.enums.ItineraryItemType;
import fu.tripsense.tripservice.enums.TripStatus;
import fu.tripsense.tripservice.exception.ValidationException;
import fu.tripsense.tripservice.repository.*;
import fu.tripsense.tripservice.service.impl.AiItineraryCommitServiceImpl;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AiItineraryCommitServiceTest {
  @Mock private TripService tripService;
  @Mock private TripRepository tripRepository;
  @Mock private TripMemberRepository memberRepository;
  @Mock private ItineraryDayRepository dayRepository;
  @Mock private ItineraryItemRepository itemRepository;
  @Mock private ItineraryCommitReceiptRepository receiptRepository;
  @Mock private PlaceClient placeClient;
  @Mock private ObjectMapper objectMapper;
  @Mock private CollaborationChangeService collaborationChangeService;

  private AiItineraryCommitServiceImpl service;

  @BeforeEach
  void setUp() {
    service =
        new AiItineraryCommitServiceImpl(
            tripService,
            tripRepository,
            memberRepository,
            dayRepository,
            itemRepository,
            receiptRepository,
            placeClient,
            objectMapper,
            collaborationChangeService);
  }

  @Test
  void createTripAllowsAnEmptyItinerary() {
    UUID userId = UUID.randomUUID();
    UUID tripId = UUID.randomUUID();
    UUID runId = UUID.randomUUID();
    LocalDate start = LocalDate.of(2026, 10, 10);
    LocalDate end = LocalDate.of(2026, 10, 12);
    var request =
        new AiItineraryCommitRequest(
            AiItineraryCommitRequest.Action.CREATE_TRIP,
            null,
            runId,
            "a".repeat(64),
            null,
            new AiItineraryCommitRequest.TripDraft(
                "Trip to Da Nang", "Da Nang", start, end, 2, null, null, null),
            List.of());
    Trip trip =
        Trip.builder()
            .id(tripId)
            .ownerUserId(userId)
            .name("Trip to Da Nang")
            .destinationName("Da Nang")
            .startDate(start)
            .endDate(end)
            .status(TripStatus.DRAFT)
            .aggregateRevision(0L)
            .build();
    TripResponse created =
        new TripResponse(
            tripId,
            trip.getName(),
            trip.getDestinationName(),
            null,
            null,
            start,
            end,
            TripStatus.DRAFT,
            DisplayStatus.DRAFT,
            userId,
            2,
            null,
            null,
            null,
            null,
            "PRIVATE",
            0L,
            0L,
            null,
            null);

    when(receiptRepository.findByOwnerUserIdAndIdempotencyKey(userId, "draft-key"))
        .thenReturn(Optional.empty());
    when(tripService.createTrip(any(), any())).thenReturn(created);
    when(tripRepository.findActiveByIdForUpdate(tripId)).thenReturn(Optional.of(trip));
    when(dayRepository.findByTripIdOrderByDayNumberAsc(tripId)).thenReturn(List.of());
    when(objectMapper.convertValue(any(), org.mockito.ArgumentMatchers.eq(Map.class)))
        .thenReturn(Map.of());
    when(receiptRepository.save(any(ItineraryCommitReceipt.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    var result = service.commit(userId, "draft-key", "b".repeat(64), request);

    assertThat(result.tripId()).isEqualTo(tripId);
    assertThat(result.appliedCount()).isZero();
    assertThat(result.action()).isEqualTo("CREATE_TRIP");
  }

  @Test
  void addToTripRejectsAnEmptyItinerary() {
    var request =
        new AiItineraryCommitRequest(
            AiItineraryCommitRequest.Action.ADD_TO_TRIP,
            UUID.randomUUID(),
            UUID.randomUUID(),
            "a".repeat(64),
            0L,
            null,
            List.of());

    assertThatThrownBy(() -> service.commit(UUID.randomUUID(), "add-key", "b".repeat(64), request))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("at least one itinerary item");
  }

  @Test
  void replaceTripItemsDeletesExistingAndSavesReplacementItems() {
    UUID userId = UUID.randomUUID();
    UUID tripId = UUID.randomUUID();
    UUID day1Id = UUID.randomUUID();
    UUID proposalId = UUID.randomUUID();
    Trip trip =
        Trip.builder()
            .id(tripId)
            .ownerUserId(userId)
            .name("Da Nang 2D1N")
            .destinationName("Da Nang")
            .startDate(LocalDate.of(2026, 11, 1))
            .endDate(LocalDate.of(2026, 11, 2))
            .status(TripStatus.DRAFT)
            .aggregateRevision(4L)
            .publicationRevision(1L)
            .build();
    ItineraryDay day1 =
        ItineraryDay.builder()
            .id(day1Id)
            .tripId(tripId)
            .dayNumber(1)
            .dayDate(LocalDate.of(2026, 11, 1))
            .build();
    var request =
        new AiItineraryCommitRequest(
            AiItineraryCommitRequest.Action.REPLACE_TRIP_ITEMS,
            tripId,
            proposalId,
            "a".repeat(64),
            4L,
            null,
            List.of(
                new AiItineraryCommitRequest.Item(
                    UUID.randomUUID(),
                    1,
                    "Novotel Danang Premier Han River",
                    ItineraryItemType.HOTEL,
                    "6ab7874de8e0eb488c68f6e3",
                    LocalTime.of(14, 0),
                    LocalTime.of(15, 0),
                    "Check-in")),
            null);

    when(receiptRepository.findByOwnerUserIdAndIdempotencyKey(userId, "replace-all-key"))
        .thenReturn(Optional.empty());
    when(tripRepository.findActiveByIdForUpdate(tripId)).thenReturn(Optional.of(trip));
    when(dayRepository.findByTripIdOrderByDayNumberAsc(tripId)).thenReturn(List.of(day1));
    when(placeClient.requireCanonicalPlace("6ab7874de8e0eb488c68f6e3"))
        .thenReturn(
            new PlaceSnapshot(
                "6ab7874de8e0eb488c68f6e3",
                "Novotel Danang Premier Han River",
                "36 Bach Dang, Da Nang",
                BigDecimal.valueOf(16.077),
                BigDecimal.valueOf(108.224)));
    when(itemRepository.save(any(ItineraryItem.class)))
        .thenAnswer(
            inv -> {
              ItineraryItem saved = inv.getArgument(0);
              saved.setId(UUID.randomUUID());
              return saved;
            });
    when(collaborationChangeService.record(eq(trip), eq(userId), any(), any()))
        .thenReturn(CollaborationChangeEvent.builder().revision(5L).build());
    when(objectMapper.convertValue(any(), eq(Map.class))).thenReturn(Map.of());
    when(receiptRepository.save(any(ItineraryCommitReceipt.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    var result = service.commit(userId, "replace-all-key", "b".repeat(64), request);

    verify(itemRepository).deleteByTripId(tripId);
    verify(itemRepository).flush();
    verify(collaborationChangeService).record(eq(trip), eq(userId), any(), any());
    assertThat(result.action()).isEqualTo("REPLACE_TRIP_ITEMS");
    assertThat(result.appliedCount()).isEqualTo(1);
    assertThat(result.tripRevision()).isEqualTo(5L);
    assertThat(trip.getPublicationRevision()).isEqualTo(2L);
  }

  @Test
  void replaceDaysDeletesOnlyTargetedDaysAndRejectsOutOfScopeItemBeforeDelete() {
    UUID userId = UUID.randomUUID();
    UUID tripId = UUID.randomUUID();
    UUID day1Id = UUID.randomUUID();
    UUID day2Id = UUID.randomUUID();
    Trip trip =
        Trip.builder()
            .id(tripId)
            .ownerUserId(userId)
            .name("Da Nang 2D1N")
            .destinationName("Da Nang")
            .startDate(LocalDate.of(2026, 11, 1))
            .endDate(LocalDate.of(2026, 11, 2))
            .status(TripStatus.DRAFT)
            .aggregateRevision(2L)
            .build();
    ItineraryDay day1 =
        ItineraryDay.builder()
            .id(day1Id)
            .tripId(tripId)
            .dayNumber(1)
            .dayDate(LocalDate.of(2026, 11, 1))
            .build();
    ItineraryDay day2 =
        ItineraryDay.builder()
            .id(day2Id)
            .tripId(tripId)
            .dayNumber(2)
            .dayDate(LocalDate.of(2026, 11, 2))
            .build();

    var mismatchedRequest =
        new AiItineraryCommitRequest(
            AiItineraryCommitRequest.Action.REPLACE_DAYS,
            tripId,
            UUID.randomUUID(),
            "a".repeat(64),
            2L,
            null,
            List.of(
                new AiItineraryCommitRequest.Item(
                    UUID.randomUUID(),
                    1,
                    "Wrong Day",
                    ItineraryItemType.PLACE,
                    null,
                    null,
                    null,
                    null)),
            List.of(2));

    when(receiptRepository.findByOwnerUserIdAndIdempotencyKey(userId, "replace-day-bad"))
        .thenReturn(Optional.empty());
    when(tripRepository.findActiveByIdForUpdate(tripId)).thenReturn(Optional.of(trip));
    when(dayRepository.findByTripIdOrderByDayNumberAsc(tripId)).thenReturn(List.of(day1, day2));

    assertThatThrownBy(
            () -> service.commit(userId, "replace-day-bad", "b".repeat(64), mismatchedRequest))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("not in replaceDayNumbers");
    verify(itemRepository, never()).deleteByTripIdAndDayIdIn(any(), any());

    var validRequest =
        new AiItineraryCommitRequest(
            AiItineraryCommitRequest.Action.REPLACE_DAYS,
            tripId,
            UUID.randomUUID(),
            "a".repeat(64),
            2L,
            null,
            List.of(
                new AiItineraryCommitRequest.Item(
                    UUID.randomUUID(),
                    2,
                    "Ba Na Hills",
                    ItineraryItemType.PLACE,
                    null,
                    LocalTime.of(8, 30),
                    LocalTime.of(14, 0),
                    null)),
            List.of(2));

    when(receiptRepository.findByOwnerUserIdAndIdempotencyKey(userId, "replace-day-ok"))
        .thenReturn(Optional.empty());
    when(itemRepository.save(any(ItineraryItem.class)))
        .thenAnswer(
            inv -> {
              ItineraryItem saved = inv.getArgument(0);
              saved.setId(UUID.randomUUID());
              return saved;
            });
    when(collaborationChangeService.record(eq(trip), eq(userId), any(), any()))
        .thenReturn(CollaborationChangeEvent.builder().revision(3L).build());
    when(objectMapper.convertValue(any(), eq(Map.class))).thenReturn(Map.of());
    when(receiptRepository.save(any(ItineraryCommitReceipt.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    var result = service.commit(userId, "replace-day-ok", "c".repeat(64), validRequest);

    verify(itemRepository).deleteByTripIdAndDayIdIn(tripId, List.of(day2Id));
    assertThat(result.action()).isEqualTo("REPLACE_DAYS");
    assertThat(result.appliedCount()).isEqualTo(1);
    assertThat(result.tripRevision()).isEqualTo(3L);
  }

  @Test
  void addToTripDeduplicatesSamePlaceRefOnSameDay() {
    UUID userId = UUID.randomUUID();
    UUID tripId = UUID.randomUUID();
    UUID day1Id = UUID.randomUUID();
    UUID existingItemId = UUID.randomUUID();
    UUID proposalId = UUID.randomUUID();
    Trip trip =
        Trip.builder()
            .id(tripId)
            .ownerUserId(userId)
            .name("Da Nang")
            .destinationName("Da Nang")
            .startDate(LocalDate.of(2026, 11, 1))
            .endDate(LocalDate.of(2026, 11, 1))
            .status(TripStatus.DRAFT)
            .aggregateRevision(1L)
            .build();
    ItineraryDay day1 =
        ItineraryDay.builder()
            .id(day1Id)
            .tripId(tripId)
            .dayNumber(1)
            .dayDate(LocalDate.of(2026, 11, 1))
            .build();
    ItineraryItem existingItem =
        ItineraryItem.builder()
            .id(existingItemId)
            .tripId(tripId)
            .dayId(day1Id)
            .placeRef("place-123")
            .title("My Khe Beach")
            .build();

    UUID sourceItemKey = UUID.randomUUID();
    var request =
        new AiItineraryCommitRequest(
            AiItineraryCommitRequest.Action.ADD_TO_TRIP,
            tripId,
            proposalId,
            "a".repeat(64),
            1L,
            null,
            List.of(
                new AiItineraryCommitRequest.Item(
                    sourceItemKey,
                    1,
                    "My Khe Beach",
                    ItineraryItemType.PLACE,
                    "place-123",
                    null,
                    null,
                    null)),
            null);

    when(receiptRepository.findByOwnerUserIdAndIdempotencyKey(userId, "add-dedupe"))
        .thenReturn(Optional.empty());
    when(tripRepository.findActiveByIdForUpdate(tripId)).thenReturn(Optional.of(trip));
    when(dayRepository.findByTripIdOrderByDayNumberAsc(tripId)).thenReturn(List.of(day1));
    when(placeClient.requireCanonicalPlace("place-123"))
        .thenReturn(
            new PlaceSnapshot(
                "place-123",
                "My Khe Beach",
                "Da Nang",
                BigDecimal.valueOf(16.06),
                BigDecimal.valueOf(108.24)));
    when(itemRepository.findByTripIdAndSourceProposalIdAndSourceItemKey(
            tripId, proposalId, sourceItemKey))
        .thenReturn(Optional.empty());
    when(itemRepository.findFirstByTripIdAndDayIdAndPlaceRef(tripId, day1Id, "place-123"))
        .thenReturn(Optional.of(existingItem));
    when(objectMapper.convertValue(any(), eq(Map.class))).thenReturn(Map.of());
    when(receiptRepository.save(any(ItineraryCommitReceipt.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    var result = service.commit(userId, "add-dedupe", "d".repeat(64), request);

    verify(itemRepository, never()).save(any());
    assertThat(result.appliedCount()).isZero();
    assertThat(result.skippedCount()).isEqualTo(1);
    assertThat(result.items().getFirst().status()).isEqualTo("SKIPPED_DUPLICATE");
    assertThat(result.items().getFirst().itineraryItemId()).isEqualTo(existingItemId);
  }
}
