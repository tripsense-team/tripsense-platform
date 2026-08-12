package fu.tripsense.userservice.client.impl;

import fu.tripsense.userservice.client.EmailClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Component
@Slf4j
public class EmailClientImpl implements EmailClient {

    private final RestClient restClient;

    public EmailClientImpl(@Value("${email-service.url:http://localhost:8082}") String emailServiceUrl) {
        this.restClient = RestClient.builder()
                .baseUrl(emailServiceUrl)
                .build();
    }

    @Override
    public void sendVerificationCode(String toEmail, String code) {
        log.info("Dispatching email verification code for {} to EmailService microservice", toEmail);
        try {
            restClient.post()
                    .uri("/api/v1/emails/verification")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "toEmail", toEmail,
                            "code", code
                    ))
                    .retrieve()
                    .toBodilessEntity();
            log.info("Successfully dispatched verification email request for {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send verification email via EmailService to {}: {}", toEmail, e.getMessage());
            log.warn("Fallback - Verification code for {}: {}", toEmail, code);
        }
    }

    @Override
    public void sendPasswordResetCode(String toEmail, String code) {
        log.info("Dispatching password reset code for {} to EmailService microservice", toEmail);
        try {
            restClient.post()
                    .uri("/api/v1/emails/password-reset")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "toEmail", toEmail,
                            "code", code
                    ))
                    .retrieve()
                    .toBodilessEntity();
            log.info("Successfully dispatched password reset email request for {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send password reset email via EmailService to {}: {}", toEmail, e.getMessage());
            log.warn("Fallback - Password reset code for {}: {}", toEmail, code);
        }
    }

    @Override
    public void sendTemplateEmail(String toEmail, String subject, String templateName, Map<String, Object> variables) {
        log.info("Dispatching template email [{}] for {} to EmailService microservice", templateName, toEmail);
        try {
            restClient.post()
                    .uri("/api/v1/emails/template")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "toEmail", toEmail,
                            "subject", subject != null ? subject : "",
                            "templateName", templateName,
                            "variables", variables != null ? variables : Map.of()
                    ))
                    .retrieve()
                    .toBodilessEntity();
            log.info("Successfully dispatched template email request [{}] for {}", templateName, toEmail);
        } catch (Exception e) {
            log.error("Failed to send template email [{}] via EmailService to {}: {}", templateName, toEmail, e.getMessage());
            log.warn("Fallback - Email [{}] for {} with variables: {}", templateName, toEmail, variables);
        }
    }
}
