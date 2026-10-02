package fu.tripsense.placeservice.dto;

import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import fu.tripsense.placeservice.domain.model.ApiKeyStatus;
import jakarta.validation.constraints.NotNull;

public record RotateApiKeyRequest(
    @NotNull ApiKeyProvider provider,
    String failedKey,
    ApiKeyStatus status,
    String reason
) {}
