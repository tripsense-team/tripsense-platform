package fu.tripsense.emailservice.controller;

import fu.tripsense.emailservice.dto.request.SendPasswordResetEmailRequest;
import fu.tripsense.emailservice.dto.request.SendTemplateEmailRequest;
import fu.tripsense.emailservice.dto.request.SendVerificationEmailRequest;
import fu.tripsense.emailservice.dto.response.ApiResponse;
import fu.tripsense.emailservice.dto.response.EmailResponse;
import fu.tripsense.emailservice.service.EmailService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/emails")
@RequiredArgsConstructor
@Slf4j
public class EmailController {

    private final EmailService emailService;

    @PostMapping("/verification")
    public ResponseEntity<ApiResponse<EmailResponse>> sendVerificationEmail(@Valid @RequestBody SendVerificationEmailRequest request) {
        log.info("Received request to send verification email to {}", request.toEmail());
        emailService.sendVerificationCode(request.toEmail(), request.code());
        return ResponseEntity.ok(ApiResponse.success("Verification email request processed successfully", new EmailResponse(true, "Verification email request processed")));
    }

    @PostMapping("/password-reset")
    public ResponseEntity<ApiResponse<EmailResponse>> sendPasswordResetEmail(@Valid @RequestBody SendPasswordResetEmailRequest request) {
        log.info("Received request to send password reset email to {}", request.toEmail());
        emailService.sendPasswordResetCode(request.toEmail(), request.code());
        return ResponseEntity.ok(ApiResponse.success("Password reset email request processed successfully", new EmailResponse(true, "Password reset email request processed")));
    }

    @PostMapping("/template")
    public ResponseEntity<ApiResponse<EmailResponse>> sendTemplateEmail(@Valid @RequestBody SendTemplateEmailRequest request) {
        log.info("Received request to send template email [{}] to {}", request.templateName(), request.toEmail());
        emailService.sendTemplateEmail(request.toEmail(), request.subject(), request.templateName(), request.variables());
        return ResponseEntity.ok(ApiResponse.success("Template email request processed successfully", new EmailResponse(true, "Template email request processed successfully")));
    }
}
