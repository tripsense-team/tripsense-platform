package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record SupportCaseAssignmentRequest(
    @NotNull UUID assignedAdmin
) {}
