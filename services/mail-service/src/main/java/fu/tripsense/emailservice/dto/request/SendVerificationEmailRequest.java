package fu.tripsense.emailservice.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record SendVerificationEmailRequest(
        @NotBlank @Email String toEmail,
        @NotBlank String code
) {}
