package fu.tripsense.emailservice.controller;

import fu.tripsense.emailservice.dto.request.SendPasswordResetEmailRequest;
import fu.tripsense.emailservice.dto.request.SendTemplateEmailRequest;
import fu.tripsense.emailservice.dto.request.SendVerificationEmailRequest;
import fu.tripsense.emailservice.dto.response.ApiResponse;
import fu.tripsense.emailservice.dto.response.EmailResponse;
import fu.tripsense.emailservice.service.EmailService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class EmailControllerTest {

    @Mock
    private EmailService emailService;

    @InjectMocks
    private EmailController emailController;

    @Test
    void testSendVerificationEmail() {
        SendVerificationEmailRequest request = new SendVerificationEmailRequest("user@example.com", "123456");

        ResponseEntity<ApiResponse<EmailResponse>> response = emailController.sendVerificationEmail(request);

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().success());
        assertNotNull(response.getBody().data());
        assertTrue(response.getBody().data().success());
        verify(emailService).sendVerificationCode("user@example.com", "123456");
    }

    @Test
    void testSendPasswordResetEmail() {
        SendPasswordResetEmailRequest request = new SendPasswordResetEmailRequest("user@example.com", "654321");

        ResponseEntity<ApiResponse<EmailResponse>> response = emailController.sendPasswordResetEmail(request);

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().success());
        assertNotNull(response.getBody().data());
        assertTrue(response.getBody().data().success());
        verify(emailService).sendPasswordResetCode("user@example.com", "654321");
    }

    @Test
    void testSendTemplateEmail() {
        SendTemplateEmailRequest request = new SendTemplateEmailRequest(
                "customer@email.com",
                "Order Confirmation",
                "order-confirmation",
                Map.of("PRODUCT", "Vintage Macintosh", "PRICE", 499)
        );

        ResponseEntity<ApiResponse<EmailResponse>> response = emailController.sendTemplateEmail(request);

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().success());
        assertNotNull(response.getBody().data());
        assertTrue(response.getBody().data().success());
        verify(emailService).sendTemplateEmail("customer@email.com", "Order Confirmation", "order-confirmation", Map.of("PRODUCT", "Vintage Macintosh", "PRICE", 499));
    }
}
