package fu.tripsense.tripservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.client.PlaceClient;
import fu.tripsense.tripservice.dto.request.AiItineraryCommitRequest;
import fu.tripsense.tripservice.dto.response.TripResponse;
import fu.tripsense.tripservice.entity.ItineraryCommitReceipt;
import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.enums.DisplayStatus;
import fu.tripsense.tripservice.enums.TripStatus;
import fu.tripsense.tripservice.exception.ValidationException;
import fu.tripsense.tripservice.repository.*;
import fu.tripsense.tripservice.service.impl.AiItineraryCommitServiceImpl;
import java.time.LocalDate;
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
            objectMapper);
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
}
