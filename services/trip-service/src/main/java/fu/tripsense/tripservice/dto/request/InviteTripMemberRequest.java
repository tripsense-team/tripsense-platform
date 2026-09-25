package fu.tripsense.tripservice.dto.request;

import fu.tripsense.tripservice.enums.TripMemberRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;

@Builder
public record InviteTripMemberRequest(
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    String email,

    @NotNull(message = "Role is required")
    TripMemberRole role,

    String message
) {}
