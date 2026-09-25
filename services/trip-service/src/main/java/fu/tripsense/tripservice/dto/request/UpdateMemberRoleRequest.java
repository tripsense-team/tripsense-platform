package fu.tripsense.tripservice.dto.request;

import fu.tripsense.tripservice.enums.TripMemberRole;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;

@Builder
public record UpdateMemberRoleRequest(
    @NotNull(message = "Role is required")
    TripMemberRole role
) {}
