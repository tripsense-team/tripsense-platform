package fu.tripsense.emailservice.service;

import java.util.Map;

public interface EmailService {

    void sendVerificationCode(String toEmail, String code);

    void sendPasswordResetCode(String toEmail, String code);

    void sendTemplateEmail(String toEmail, String subject, String templateName, Map<String, Object> variables);
}
