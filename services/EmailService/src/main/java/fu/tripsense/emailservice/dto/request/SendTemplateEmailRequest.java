package fu.tripsense.emailservice.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.util.Map;

public record SendTemplateEmailRequest(
        @NotBlank @Email String toEmail,
        String subject,
        @NotBlank String templateName,
        Map<String, Object> variables
) {}
