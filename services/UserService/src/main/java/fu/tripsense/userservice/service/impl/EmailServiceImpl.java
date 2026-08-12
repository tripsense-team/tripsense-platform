package fu.tripsense.userservice.service.impl;

import fu.tripsense.userservice.service.EmailService;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class EmailServiceImpl implements EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String fromEmail;

    @Override
    public void sendVerificationCode(String toEmail, String code) {
        log.info("Sending email verification code to {}: [CODE: {}]", toEmail, code);

        if (mailSender == null || fromEmail == null || fromEmail.isBlank()) {
            log.warn("SMTP mail sender or username is not configured. Email to {} simulated in console log.", toEmail);
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("Mã xác nhận đăng ký tài khoản TripSense");

            String htmlContent = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2c3e50; text-align: center;">Xác thực tài khoản TripSense</h2>
                    <p>Xin chào,</p>
                    <p>Cảm ơn bạn đã đăng ký tài khoản tại <strong>TripSense</strong>. Mã xác thực (OTP) của bạn là:</p>
                    <div style="text-align: center; margin: 25px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb; background-color: #f1f5f9; padding: 10px 20px; border-radius: 6px; display: inline-block;">%s</span>
                    </div>
                    <p style="color: #64748b; font-size: 14px;">Mã này có hiệu lực trong <strong>10 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="color: #94a3b8; font-size: 12px; text-align: center;">Trân trọng,<br/>Đội ngũ TripSense Platform</p>
                </div>
            """.formatted(code);

            helper.setText(htmlContent, true);
            mailSender.send(message);

            log.info("Email verification code sent successfully to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", toEmail, e.getMessage());
            log.warn("Fallback - Verification code for {}: [CODE: {}]", toEmail, code);
        }
    }
}
