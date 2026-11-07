package fu.tripsense.placeservice.controller;

import fu.tripsense.placeservice.dto.ApiResponse;
import fu.tripsense.placeservice.dto.BatchEnrichmentProgressDto;
import fu.tripsense.placeservice.dto.BatchEnrichmentRequest;
import fu.tripsense.placeservice.service.PlaceBatchEnrichmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/places/internal/migration")
@RequiredArgsConstructor
public class InternalPlaceMigrationController {

  private final PlaceBatchEnrichmentService enrichmentService;

  @PostMapping("/photos")
  public ResponseEntity<ApiResponse<BatchEnrichmentProgressDto>> triggerPhotoMigration(
      @RequestParam(name = "limit", defaultValue = "50") int limit,
      @RequestParam(name = "concurrency", defaultValue = "3") int concurrency) {
    log.info("Internal photo migration requested (limit={}, concurrency={})", limit, concurrency);
    BatchEnrichmentRequest request =
        BatchEnrichmentRequest.builder()
            .limit(limit)
            .concurrency(concurrency)
            .stalePhotosOnly(true)
            .build();
    return ResponseEntity.ok(ApiResponse.ok(enrichmentService.startBatchEnrichment(request)));
  }

  @GetMapping("/progress")
  public ResponseEntity<ApiResponse<BatchEnrichmentProgressDto>> getProgress() {
    return ResponseEntity.ok(ApiResponse.ok(enrichmentService.getProgress()));
  }
}

