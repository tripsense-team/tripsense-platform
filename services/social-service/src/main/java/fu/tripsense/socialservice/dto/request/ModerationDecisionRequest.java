package fu.tripsense.socialservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ModerationDecisionRequest(@NotBlank String action, @Size(max = 500) String note) {}
