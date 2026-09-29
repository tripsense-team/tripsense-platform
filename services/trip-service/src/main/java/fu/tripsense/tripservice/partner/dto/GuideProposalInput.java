package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record GuideProposalInput(
    @NotNull Long expectedVersion,
    @NotNull Integer requirementsRevision,
    @NotBlank String offeredAreaId,
    @NotEmpty List<String> offeredTopicIds,
    @NotEmpty List<String> offeredSkillIds,
    @NotBlank String languageCode,
    List<String> unmetSoftRequirements,
    String explanation,
    @NotNull Instant proposedStartAt,
    @NotBlank String timeZone,
    @Min(30) @Max(1440) int durationMinutes,
    @NotBlank @Size(max = 4000) String program,
    List<String> inclusions,
    List<String> exclusions,
    @NotNull @DecimalMin(value = "0.0", inclusive = false) BigDecimal estimatedTotalVnd,
    @NotNull Instant validUntil,
    @NotNull ProposalContactConsent contactConsent
) {}
