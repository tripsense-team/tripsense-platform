package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record PublicationRequest(
    @NotNull Long expectedVersion,
    @NotBlank String state
) {}
