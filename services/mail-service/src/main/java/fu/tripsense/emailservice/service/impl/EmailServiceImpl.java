package fu.tripsense.emailservice.service.impl;

import fu.tripsense.emailservice.service.EmailService;
import fu.tripsense.emailservice.util.ResendMailUtil;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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
    log.info(
        "Sending email verification code to {} using template [{}]", toEmail, verificationTemplate);
    String userName = toEmail.contains("@") ? toEmail.substring(0, toEmail.indexOf('@')) : toEmail;
    Map<String, Object> variables =
        Map.of(
            "CODE", code,
            "EXPIRE_MINUTES", "10",
            "USER_NAME", userName);
    resendMailUtil.sendTemplateEmail(
        toEmail, "Mã xác nhận đăng ký tài khoản TripSense", verificationTemplate, variables);
  }

  @Override
  public void sendPasswordResetCode(String toEmail, String code) {
    log.info(
        "Sending password reset code to {} using template [{}]", toEmail, passwordResetTemplate);
    String userName = toEmail.contains("@") ? toEmail.substring(0, toEmail.indexOf('@')) : toEmail;
    Map<String, Object> variables =
        Map.of(
            "CODE", code,
            "EXPIRE_MINUTES", "10",
            "USER_NAME", userName);
    resendMailUtil.sendTemplateEmail(
        toEmail, "Yêu cầu đặt lại mật khẩu - TripSense", passwordResetTemplate, variables);
  }

  @Override
  public void sendTemplateEmail(
      String toEmail, String subject, String templateName, Map<String, Object> variables) {
    log.info("Sending generic template email [{}] to {}", templateName, toEmail);
    resendMailUtil.sendTemplateEmail(toEmail, subject, templateName, variables);
  }

  @Override
  public void sendTripInvitation(
      String toEmail,
      String tripName,
      String role,
      String message,
      String joinUrl,
      Instant expiresAt) {
    String safeTripName = escapeHtml(tripName);
    String safeRole = escapeHtml(role);
    String safeJoinUrl = escapeHtml(joinUrl);
    String safeMessage = message == null || message.isBlank() ? "" : escapeHtml(message);
    String expiry =
        DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm z")
            .withZone(ZoneId.of("Asia/Ho_Chi_Minh"))
            .format(expiresAt);
    String messageBlock =
        safeMessage.isBlank()
            ? ""
            : "<div style=\"margin:20px 0;padding:14px 16px;background:#f5f5f4;border-radius:12px\">"
                + safeMessage
                + "</div>";
    String html =
        """
        <!doctype html><html><body style="font-family:Arial,sans-serif;color:#1c1917;background:#fafaf9;padding:24px">
        <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e7e5e4;border-radius:20px;padding:28px">
          <h1 style="margin:0 0 12px">Bạn được mời cùng lên kế hoạch chuyến đi</h1>
          <p>Một thành viên TripSense đã mời bạn tham gia <strong>%s</strong> với vai trò <strong>%s</strong>.</p>
          %s
          <p>Nếu chưa có tài khoản, hãy mở liên kết và đăng ký bằng chính địa chỉ email nhận thư này.</p>
          <p style="margin:28px 0"><a href="%s" style="background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">Xem và xác nhận lời mời</a></p>
          <p style="font-size:13px;color:#78716c">Lời mời hết hạn lúc %s. Không chuyển tiếp email này vì liên kết mang token riêng.</p>
        </div></body></html>
        """
            .formatted(safeTripName, safeRole, messageBlock, safeJoinUrl, expiry);
    resendMailUtil.sendHtmlEmail(
        toEmail,
        "Lời mời tham gia chuyến đi “"
            + tripName.replace("\r", " ").replace("\n", " ")
            + "” trên TripSense",
        html);
  }

  private String escapeHtml(String value) {
    return value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;");
  }
}
