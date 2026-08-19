package fu.tripsense.emailservice.service.impl;

import fu.tripsense.emailservice.service.EmailService;
import fu.tripsense.emailservice.util.ResendMailUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailServiceImpl implements EmailService {

    private final ResendMailUtil resendMailUtil;

    @Value("${resend.templates.verification:fe57f2e7-61bb-457f-9ec7-9ec3709a1b98}")
    private String verificationTemplate;

    @Value("${resend.templates.password-reset}")
    private String passwordResetTemplate;

    @Override
    public void sendVerificationCode(String toEmail, String code) {
        log.info("Sending email verification code to {} using template [{}]", toEmail, verificationTemplate);
        String userName = toEmail.contains("@") ? toEmail.substring(0, toEmail.indexOf('@')) : toEmail;
        Map<String, Object> variables = Map.of(
                "CODE", code,
                "EXPIRE_MINUTES", "10",
                "USER_NAME", userName
        );
        resendMailUtil.sendTemplateEmail(toEmail, "Mã xác nhận đăng ký tài khoản TripSense", verificationTemplate, variables);
    }

    @Override
    public void sendPasswordResetCode(String toEmail, String code) {
        log.info("Sending password reset code to {} using template [{}]", toEmail, passwordResetTemplate);
        String userName = toEmail.contains("@") ? toEmail.substring(0, toEmail.indexOf('@')) : toEmail;
        Map<String, Object> variables = Map.of(
                "CODE", code,
                "EXPIRE_MINUTES", "10",
                "USER_NAME", userName
        );
        resendMailUtil.sendTemplateEmail(toEmail, "Yêu cầu đặt lại mật khẩu - TripSense", passwordResetTemplate, variables);
    }

    @Override
    public void sendTemplateEmail(String toEmail, String subject, String templateName, Map<String, Object> variables) {
        log.info("Sending generic template email [{}] to {}", templateName, toEmail);
        resendMailUtil.sendTemplateEmail(toEmail, subject, templateName, variables);
    }
}
