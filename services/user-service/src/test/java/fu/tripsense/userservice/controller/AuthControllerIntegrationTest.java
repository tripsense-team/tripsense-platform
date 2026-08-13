package fu.tripsense.userservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.userservice.dto.request.LoginRequest;
import fu.tripsense.userservice.dto.request.RegisterRequest;
import fu.tripsense.userservice.dto.request.VerifyEmailRequest;
import fu.tripsense.userservice.entity.EmailVerificationCode;
import fu.tripsense.userservice.repository.EmailVerificationCodeRepository;
import fu.tripsense.userservice.repository.RefreshTokenRepository;
import fu.tripsense.userservice.repository.SessionRepository;
import fu.tripsense.userservice.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
class AuthControllerIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private EmailVerificationCodeRepository emailVerificationCodeRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        emailVerificationCodeRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        sessionRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("Should register new user as UNVERIFIED, verify email code to become ACTIVE, then login")
    void testRegisterVerifyAndLoginFlow() throws Exception {
        RegisterRequest registerRequest = new RegisterRequest("john.doe@example.com", "Password@123");

        // 1. Register User (State: UNVERIFIED)
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value("john.doe@example.com"))
                .andExpect(jsonPath("$.data.status").value("UNVERIFIED"));

        // 2. Try Login before email verification -> 401 Unauthorized
        LoginRequest unverifiedLoginRequest = new LoginRequest("john.doe@example.com", "Password@123");
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(unverifiedLoginRequest)))
                .andExpect(status().isUnauthorized());

        // Fetch latest verification code entity from DB to retrieve actual hashed code
        EmailVerificationCode codeEntity = emailVerificationCodeRepository
                .findTopByUserEmailAndVerifiedAtIsNullOrderByCreatedAtDesc("john.doe@example.com")
                .orElseThrow();

        // 3. Verify with invalid code -> 400 Bad Request
        VerifyEmailRequest invalidCodeRequest = new VerifyEmailRequest("john.doe@example.com", "000000");
        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidCodeRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid verification code"));

        // Generate known code for testing or verify directly by inserting test code
        // For test verification, let's verify with wrong code then test successful verification flow
        // Update test code hash in DB to match "123456"
        codeEntity.setCodeHash(fu.tripsense.userservice.util.TokenHashUtils.hashToken("123456"));
        emailVerificationCodeRepository.save(codeEntity);

        // 4. Verify Email with correct code "123456"
        VerifyEmailRequest validCodeRequest = new VerifyEmailRequest("john.doe@example.com", "123456");
        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validCodeRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));

        // 5. Login with registered & verified credentials -> 200 OK
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(unverifiedLoginRequest)))
                .andExpect(status().isOk())
                .andExpect(cookie().exists("refreshToken"))
                .andExpect(cookie().httpOnly("refreshToken", true))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.user.email").value("john.doe@example.com"));
    }

    @Test
    @DisplayName("Should refresh access token when valid refreshToken cookie is provided")
    void testRefreshTokenSuccessAndFailureCases() throws Exception {
        RegisterRequest registerRequest = new RegisterRequest("refresh.test@example.com", "Password@123");
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated());

        EmailVerificationCode codeEntity = emailVerificationCodeRepository
                .findTopByUserEmailAndVerifiedAtIsNullOrderByCreatedAtDesc("refresh.test@example.com")
                .orElseThrow();

        codeEntity.setCodeHash(fu.tripsense.userservice.util.TokenHashUtils.hashToken("123456"));
        emailVerificationCodeRepository.save(codeEntity);

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new VerifyEmailRequest("refresh.test@example.com", "123456"))))
                .andExpect(status().isOk());

        LoginRequest loginRequest = new LoginRequest("refresh.test@example.com", "Password@123");
        var loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        var refreshCookie = loginResult.getResponse().getCookie("refreshToken");
        String responseBodyStr = loginResult.getResponse().getContentAsString();
        String accessToken = objectMapper.readTree(responseBodyStr).path("data").path("accessToken").asText();

        // 1. Success: Refresh using valid refreshToken cookie
        var refreshResult = mockMvc.perform(post("/api/auth/refresh")
                        .cookie(refreshCookie))
                .andExpect(status().isOk())
                .andExpect(cookie().exists("refreshToken"))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Access token refreshed successfully"))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andReturn();

        var rotatedCookie = refreshResult.getResponse().getCookie("refreshToken");

        // 2. Failure: Re-using OLD revoked Refresh Token -> 401 Unauthorized
        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(refreshCookie))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));

        // 3. Success: Using the NEW rotated Refresh Token -> 200 OK
        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(rotatedCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // 4. Failure: Missing Cookie -> 401 Unauthorized
        mockMvc.perform(post("/api/auth/refresh"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));

        // 5. Failure: Access Token sent to refresh endpoint (type == ACCESS) -> 401 Unauthorized
        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("refreshToken", accessToken)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));

        // 6. Failure: Invalid signature / tampered token -> 401 Unauthorized
        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("refreshToken", refreshCookie.getValue() + "invalid")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }
}
