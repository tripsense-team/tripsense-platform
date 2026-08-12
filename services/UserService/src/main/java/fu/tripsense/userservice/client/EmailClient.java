package fu.tripsense.userservice.client;

import java.util.Map;

public interface EmailClient {

    void sendVerificationCode(String toEmail, String code);

    void sendPasswordResetCode(String toEmail, String code);

    void sendTemplateEmail(String toEmail, String subject, String templateName, Map<String, Object> variables);
}
