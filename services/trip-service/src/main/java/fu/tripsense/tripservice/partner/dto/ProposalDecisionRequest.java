package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;

public record ProposalDecisionRequest(
    @NotNull Long expectedVersion,
    @NotNull UUID proposalId,
    @NotBlank @Pattern(regexp = "REQUEST_REVISION|AGREE_TO_CONTACT") String action,
    String note,
    ProposalContactConsent contactConsent
) {}
