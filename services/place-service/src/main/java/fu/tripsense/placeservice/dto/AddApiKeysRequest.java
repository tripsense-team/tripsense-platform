package fu.tripsense.placeservice.dto;

import fu.tripsense.placeservice.domain.model.ApiKeyProvider;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record AddApiKeysRequest(
    @NotNull ApiKeyProvider provider,
    @NotEmpty List<String> keys) {}
