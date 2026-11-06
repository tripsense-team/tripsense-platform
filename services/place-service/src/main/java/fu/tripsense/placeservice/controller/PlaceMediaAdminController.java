package fu.tripsense.placeservice.controller;

import fu.tripsense.placeservice.domain.model.PlaceMediaAsset;
import fu.tripsense.placeservice.domain.model.PlaceMediaState;
import fu.tripsense.placeservice.dto.ApiResponse;
import fu.tripsense.placeservice.dto.PlaceMediaAdminDtos;
import fu.tripsense.placeservice.service.PlaceMediaService;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/places/admin")
public class PlaceMediaAdminController {
  private final PlaceMediaService media;

  public PlaceMediaAdminController(PlaceMediaService media) {
    this.media = media;
  }

  @GetMapping("/media/coverage")
  public ResponseEntity<ApiResponse<PlaceMediaAdminDtos.CoverageResponse>> coverage(
      @RequestParam(required = false) String destinationId,
      @RequestParam(required = false) PlaceMediaState state,
      @RequestParam(defaultValue = "0") int cursor,
      @RequestParam(defaultValue = "50") int limit) {
    return ResponseEntity.ok(ApiResponse.ok(media.coverage(state, destinationId, cursor, limit)));
  }

  @PostMapping(value = "/{placeId}/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<ApiResponse<PlaceMediaAdminDtos.AssetAdminResponse>> upload(
      @PathVariable String placeId,
      @RequestPart("file") MultipartFile file,
      @RequestParam PlaceMediaAsset.SourceType sourceType,
      @RequestParam PlaceMediaAsset.LicenseType licenseType,
      @RequestParam(required = false) String licenseEvidenceUrl,
      @RequestParam(required = false) String attributionLabel,
      @RequestParam(required = false) String attributionUrl,
      @RequestParam(defaultValue = "false") boolean makePrimary) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(
            ApiResponse.ok(
                media.upload(
                    placeId,
                    file,
                    sourceType,
                    licenseType,
                    licenseEvidenceUrl,
                    attributionLabel,
                    attributionUrl,
                    makePrimary)));
  }

  @PostMapping("/{placeId}/media/{assetId}/approve")
  public ResponseEntity<ApiResponse<PlaceMediaAdminDtos.AssetAdminResponse>> approve(
      @PathVariable String placeId,
      @PathVariable String assetId,
      @Valid @RequestBody(required = false) PlaceMediaAdminDtos.ApproveRequest request) {
    return ResponseEntity.ok(
        ApiResponse.ok(
            media.approve(placeId, assetId, request != null && Boolean.TRUE.equals(request.makePrimary()))));
  }

  @PostMapping("/{placeId}/media/{assetId}/reject")
  public ResponseEntity<ApiResponse<PlaceMediaAdminDtos.AssetAdminResponse>> reject(
      @PathVariable String placeId,
      @PathVariable String assetId,
      @Valid @RequestBody PlaceMediaAdminDtos.RejectRequest request) {
    return ResponseEntity.ok(ApiResponse.ok(media.reject(placeId, assetId, request.reasonCode())));
  }

  @PutMapping("/{placeId}/media/primary")
  public ResponseEntity<ApiResponse<PlaceMediaAdminDtos.AssetAdminResponse>> primary(
      @PathVariable String placeId,
      @Valid @RequestBody PlaceMediaAdminDtos.PrimaryRequest request) {
    return ResponseEntity.ok(ApiResponse.ok(media.setPrimary(placeId, request.assetId())));
  }

  @DeleteMapping("/{placeId}/media/{assetId}")
  public ResponseEntity<Void> delete(
      @PathVariable String placeId, @PathVariable String assetId) {
    media.delete(placeId, assetId);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/media/backfill-jobs")
  public ResponseEntity<ApiResponse<PlaceMediaAdminDtos.BackfillJobResponse>> startBackfill(
      @Valid @RequestBody PlaceMediaAdminDtos.BackfillRequest request) {
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ApiResponse.ok(media.startBackfill(request)));
  }

  @GetMapping("/media/backfill-jobs/{jobId}")
  public ResponseEntity<ApiResponse<PlaceMediaAdminDtos.BackfillJobResponse>> backfill(
      @PathVariable String jobId) {
    return ResponseEntity.ok(ApiResponse.ok(media.getBackfill(jobId)));
  }
}
