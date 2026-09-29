package fu.tripsense.placeservice.dto;

import fu.tripsense.placeservice.domain.model.ApiKeyPoolItem;
import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import fu.tripsense.placeservice.domain.model.ApiKeyStatus;
import java.time.Instant;

public record ApiKeyPoolItemDto(
    String id,
    ApiKeyProvider provider,
    String maskedKey,
    ApiKeyStatus status,
    long successCount,
    String failureReason,
    Instant lastUsedAt,
    Instant exhaustedAt,
    Instant createdAt) {

  public static ApiKeyPoolItemDto from(ApiKeyPoolItem item) {
    return new ApiKeyPoolItemDto(
        item.getId(),
        item.getProvider(),
        item.getMaskedKey(),
        item.getStatus(),
        item.getSuccessCount(),
        item.getFailureReason(),
        item.getLastUsedAt(),
        item.getExhaustedAt(),
        item.getCreatedAt());
  }
}
