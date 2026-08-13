package fu.tripsense.emailservice.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record SendPasswordResetEmailRequest(
        @NotBlank @Email String toEmail,
        @NotBlank String code
) {}
