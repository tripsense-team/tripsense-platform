package fu.tripsense.placeservice.dto;

import fu.tripsense.placeservice.domain.model.PlaceMediaAsset;
import fu.tripsense.placeservice.domain.model.PlaceMediaBackfillJob;
import fu.tripsense.placeservice.domain.model.PlaceMediaState;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

public final class PlaceMediaAdminDtos {
  private PlaceMediaAdminDtos() {}

  public record ApproveRequest(Boolean makePrimary) {}

  public record RejectRequest(
      @NotBlank @Size(max = 64) String reasonCode) {}

  public record PrimaryRequest(@NotBlank String assetId) {}

  public record BackfillRequest(
      @Size(max = 120) String destinationId,
      @NotEmpty @Size(max = 6) List<PlaceMediaState> states,
      @Min(1) @Max(500) Integer limit,
      Boolean dryRun,
      @Min(1) @Max(3) Integer maxConcurrency,
      @NotBlank @Size(max = 160) String idempotencyKey) {
    public int effectiveLimit() { return limit == null ? 100 : limit; }
    public int effectiveConcurrency() { return maxConcurrency == null ? 2 : maxConcurrency; }
    public boolean isDryRun() { return !Boolean.FALSE.equals(dryRun); }
  }

  public record CoverageResponse(
      Map<PlaceMediaState, Long> counts,
      List<CoverageItem> items,
      String nextCursor) {}

  public record CoverageItem(
      String placeId, String name, PlaceMediaState state, String reasonCode) {}

  public record AssetAdminResponse(
      String id,
      String placeId,
      PlaceMediaAsset.ModerationStatus moderationStatus,
      PlaceMediaAsset.HealthStatus healthStatus,
      String url) {}

  public record BackfillJobResponse(
      String id,
      PlaceMediaBackfillJob.Status status,
      boolean dryRun,
      int total,
      int processed,
      int succeeded,
      int failed,
      String lastReasonCode) {}
}
