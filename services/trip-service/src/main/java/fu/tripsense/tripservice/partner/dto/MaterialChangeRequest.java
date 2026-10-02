package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record MaterialChangeRequest(
    @NotNull Long expectedVersion,
    @NotBlank String kind,
    @NotBlank String reason,
    UUID reverificationApplicationId
) {}
