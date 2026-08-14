package fu.tripsense.emailservice.util;

import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.CreateEmailOptions;
import com.resend.services.emails.model.CreateEmailResponse;
import com.resend.services.emails.model.Template;
import fu.tripsense.emailservice.exception.EmailSendException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@Slf4j
public class ResendMailUtil {

    @Value("${resend.api-key}")
    private String resendApiKey;

    @Value("${resend.from-email}")
    private String resendFromEmail;

    public CreateEmailResponse sendTemplateEmail(String toEmail, String subject, String templateId, Map<String, Object> variables) {
        log.info("Sending template email [{}] to {} with variables: {}", templateId, toEmail, variables);

        if (resendApiKey == null || resendApiKey.isBlank()) {
            log.warn("[SIMULATION] RESEND_API_KEY is not configured. Email [{}] to {} simulated with variables: {}", templateId, toEmail, variables);
            return null;
        }

        try {
            Resend resend = new Resend(resendApiKey);

            CreateEmailOptions params = CreateEmailOptions.builder()
                    .from(resendFromEmail)
                    .to(toEmail)
                    .subject(subject != null && !subject.isBlank() ? subject : "TripSense Notification")
                    .template(Template.builder()
                            .id(templateId)
                            .variables(variables)
                            .build())
                    .build();

            CreateEmailResponse response = resend.emails().send(params);
            log.info("Email [{}] sent successfully via Resend to {}. Resend ID: {}", templateId, toEmail, response.getId());
            return response;
        } catch (ResendException e) {
            log.error("Failed to send template email [{}] via Resend to {}: {}", templateId, toEmail, e.getMessage(), e);
            throw new EmailSendException("Failed to send email via Resend: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error while sending email [{}] to {}: {}", templateId, toEmail, e.getMessage(), e);
            throw new EmailSendException("Unexpected email sending error: " + e.getMessage(), e);
        }
    }
}
