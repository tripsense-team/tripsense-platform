package fu.tripsense.placeservice.controller;

import fu.tripsense.placeservice.dto.ApiResponse;
import fu.tripsense.placeservice.dto.BatchEnrichmentProgressDto;
import fu.tripsense.placeservice.dto.BatchEnrichmentRequest;
import fu.tripsense.placeservice.dto.PlaceStatsDto;
import fu.tripsense.placeservice.dto.ZioMapKeyUpdateRequest;
import fu.tripsense.placeservice.dto.ZioMapKeyUpdateResponse;
import fu.tripsense.placeservice.providers.ziomap.ZioMapProvider;
import fu.tripsense.placeservice.service.PlaceBatchEnrichmentService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/places/internal")
public class PlaceBatchEnrichmentController {

  private final PlaceBatchEnrichmentService enrichmentService;
  private final ZioMapProvider zioMapProvider;

  public PlaceBatchEnrichmentController(
      PlaceBatchEnrichmentService enrichmentService, ZioMapProvider zioMapProvider) {
    this.enrichmentService = enrichmentService;
    this.zioMapProvider = zioMapProvider;
  }

  @GetMapping("/stats")
  public ResponseEntity<ApiResponse<PlaceStatsDto>> getStats() {
    return ResponseEntity.ok(ApiResponse.ok(enrichmentService.getStats()));
  }

  @PostMapping("/config/ziomap")
  public ResponseEntity<ApiResponse<ZioMapKeyUpdateResponse>> updateZioMapKey(
      @Valid @RequestBody ZioMapKeyUpdateRequest request) {
    boolean valid = zioMapProvider.validateAndApplyApiKey(request.getApiKey());
    if (valid) {
      ZioMapKeyUpdateResponse response =
          ZioMapKeyUpdateResponse.builder()
              .valid(true)
              .message("ZioMap API key updated and verified successfully")
              .maskedKey(zioMapProvider.getMaskedApiKey())
              .build();
      return ResponseEntity.ok(ApiResponse.ok(response));
    } else {
      return ResponseEntity.badRequest()
          .body(
              ApiResponse.error(
                  "INVALID_KEY",
                  "Failed to verify ZioMap API key with provider endpoint. Key was not saved."));
    }
  }

  @PostMapping("/batch-enrich")
  public ResponseEntity<ApiResponse<BatchEnrichmentProgressDto>> startBatch(
      @RequestBody(required = false) BatchEnrichmentRequest request) {
    BatchEnrichmentRequest effectiveRequest =
        request != null ? request : BatchEnrichmentRequest.builder().build();
    BatchEnrichmentProgressDto progress =
        enrichmentService.startBatchEnrichment(effectiveRequest);
    return ResponseEntity.ok(ApiResponse.ok(progress));
  }

  @GetMapping("/batch-enrich/progress")
  public ResponseEntity<ApiResponse<BatchEnrichmentProgressDto>> getProgress() {
    return ResponseEntity.ok(ApiResponse.ok(enrichmentService.getProgress()));
  }

  @PostMapping("/batch-enrich/cancel")
  public ResponseEntity<ApiResponse<Boolean>> cancelBatch() {
    boolean cancelled = enrichmentService.cancel();
    return ResponseEntity.ok(ApiResponse.ok(cancelled));
  }
}
