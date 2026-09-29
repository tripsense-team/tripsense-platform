package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotNull;

public record ProposalContactConsent(
    boolean shareEmail,
    boolean sharePhone,
    String termsVersion
) {}
