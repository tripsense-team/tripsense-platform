package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotNull;

public record IntakeRequest(
    @NotNull Long expectedVersion,
    boolean acceptingNew
) {}
