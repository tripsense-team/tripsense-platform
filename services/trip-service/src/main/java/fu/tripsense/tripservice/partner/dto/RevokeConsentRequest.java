package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.ContactConsentChannel;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RevokeConsentRequest(
    @NotNull ContactConsentChannel channel,
    @Size(max = 500) String reason
) {}
