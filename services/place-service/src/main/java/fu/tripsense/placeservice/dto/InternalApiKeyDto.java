package fu.tripsense.placeservice.dto;

import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import fu.tripsense.placeservice.domain.model.ApiKeyStatus;

public record InternalApiKeyDto(
    ApiKeyProvider provider,
    String key,
    String keyHash,
    String maskedKey,
    ApiKeyStatus status
) {}
