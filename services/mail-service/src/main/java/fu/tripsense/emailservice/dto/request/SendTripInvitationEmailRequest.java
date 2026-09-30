package fu.tripsense.emailservice.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record SendTripInvitationEmailRequest(
    @NotBlank @Email String toEmail,
    @NotBlank String tripName,
    @NotBlank String role,
    String message,
    @NotBlank String joinUrl,
    @NotNull Instant expiresAt) {}
