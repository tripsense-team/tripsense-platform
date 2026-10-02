package fu.tripsense.placeservice.dto;

import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record RecordKeySuccessRequest(
    @NotNull ApiKeyProvider provider,
    @NotBlank String rawKey
) {}
