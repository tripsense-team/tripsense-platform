package fu.tripsense.placeservice.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.placeservice.dto.BatchEnrichmentProgressDto;
import fu.tripsense.placeservice.dto.BatchEnrichmentRequest;
import fu.tripsense.placeservice.dto.PlaceStatsDto;
import fu.tripsense.placeservice.dto.ZioMapKeyUpdateRequest;
import fu.tripsense.placeservice.providers.ziomap.ZioMapProvider;
import fu.tripsense.placeservice.service.PlaceBatchEnrichmentService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class PlaceBatchEnrichmentControllerTest {

  private MockMvc mockMvc;
  private final ObjectMapper objectMapper = new ObjectMapper();

  @Mock private PlaceBatchEnrichmentService enrichmentService;
  @Mock private ZioMapProvider zioMapProvider;

  @BeforeEach
  void setUp() {
    PlaceBatchEnrichmentController controller =
        new PlaceBatchEnrichmentController(enrichmentService, zioMapProvider);
    mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
  }

  @Test
  void shouldReturnStats() throws Exception {
    PlaceStatsDto stats =
        PlaceStatsDto.builder()
            .totalPlaces(833)
            .enrichedPlaces(15)
            .pendingPlaces(818)
            .zioMapKeyConfigured(true)
            .zioMapKeyMasked("eyJ1c...hub")
            .isJobRunning(false)
            .build();

    when(enrichmentService.getStats()).thenReturn(stats);

    mockMvc
        .perform(get("/api/places/admin/stats"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.totalPlaces").value(833))
        .andExpect(jsonPath("$.data.pendingPlaces").value(818))
        .andExpect(jsonPath("$.data.zioMapKeyConfigured").value(true))
        .andExpect(jsonPath("$.data.zioMapKeyMasked").value("eyJ1c...hub"));
  }

  @Test
  void shouldUpdateZioMapKeySuccessfully() throws Exception {
    when(zioMapProvider.validateAndApplyApiKey("valid_key_123")).thenReturn(true);
    when(zioMapProvider.getMaskedApiKey()).thenReturn("valid..._123");

    ZioMapKeyUpdateRequest req = new ZioMapKeyUpdateRequest("valid_key_123");

    mockMvc
        .perform(
            post("/api/places/admin/config/ziomap")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.valid").value(true))
        .andExpect(jsonPath("$.data.maskedKey").value("valid..._123"));
  }

  @Test
  void shouldRejectInvalidZioMapKey() throws Exception {
    when(zioMapProvider.validateAndApplyApiKey("bad_key")).thenReturn(false);

    ZioMapKeyUpdateRequest req = new ZioMapKeyUpdateRequest("bad_key");

    mockMvc
        .perform(
            post("/api/places/admin/config/ziomap")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.error.code").value("INVALID_KEY"));
  }

  @Test
  void shouldStartBatchEnrichment() throws Exception {
    BatchEnrichmentProgressDto progress =
        BatchEnrichmentProgressDto.builder()
            .jobId("batch-123")
            .status("RUNNING")
            .total(818)
            .processed(0)
            .percentage(0.0)
            .build();

    when(enrichmentService.startBatchEnrichment(any())).thenReturn(progress);

    BatchEnrichmentRequest req =
        BatchEnrichmentRequest.builder().concurrency(5).limit(1000).build();

    mockMvc
        .perform(
            post("/api/places/admin/batch-enrich")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.jobId").value("batch-123"))
        .andExpect(jsonPath("$.data.status").value("RUNNING"))
        .andExpect(jsonPath("$.data.total").value(818));
  }

  @Test
  void shouldReturnBatchProgress() throws Exception {
    BatchEnrichmentProgressDto progress =
        BatchEnrichmentProgressDto.builder()
            .jobId("batch-123")
            .status("RUNNING")
            .total(818)
            .processed(100)
            .success(98)
            .failed(2)
            .percentage(12.2)
            .recentLogs(List.of("[10:00:00] Enriched place 1"))
            .build();

    when(enrichmentService.getProgress()).thenReturn(progress);

    mockMvc
        .perform(get("/api/places/admin/batch-enrich/progress"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.processed").value(100))
        .andExpect(jsonPath("$.data.percentage").value(12.2));
  }

  @Test
  void shouldCancelBatch() throws Exception {
    when(enrichmentService.cancel()).thenReturn(true);

    mockMvc
        .perform(post("/api/places/admin/batch-enrich/cancel"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data").value(true));
  }
}
