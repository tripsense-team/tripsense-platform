package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotNull;

public record PublicContactConsentRequest(
    @NotNull Long expectedVersion,
    boolean publicContactConsent
) {}
