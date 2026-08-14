package fu.tripsense.userservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.userservice.dto.request.LoginRequest;
import fu.tripsense.userservice.dto.request.RegisterRequest;
import fu.tripsense.userservice.dto.response.LoginResponse;
import fu.tripsense.userservice.dto.response.LoginResult;
import fu.tripsense.userservice.dto.response.RefreshResponse;
import fu.tripsense.userservice.dto.response.RefreshResult;
import fu.tripsense.userservice.dto.response.UserDto;
import fu.tripsense.userservice.enums.UserStatus;
import fu.tripsense.userservice.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    private MockMvc mockMvc;

    @Mock
    private AuthService authService;

    @InjectMocks
    private AuthController authController;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(authController).build();
    }

    @Test
    @DisplayName("Unit Test: register() returns 201 Created and user data")
    void testRegister() throws Exception {
        RegisterRequest request = new RegisterRequest("john@example.com", "Password@123");
        UserDto userDto = UserDto.builder()
                .id(UUID.randomUUID())
                .email("john@example.com")
                .role("ROLE_USER")
                .status(UserStatus.UNVERIFIED)
                .build();

        when(authService.register(any(RegisterRequest.class))).thenReturn(userDto);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value("john@example.com"))
                .andExpect(jsonPath("$.data.status").value("UNVERIFIED"));

        verify(authService).register(any(RegisterRequest.class));
    }

    @Test
    @DisplayName("Unit Test: login() returns 200 OK, Set-Cookie header, and access token")
    void testLogin() throws Exception {
        LoginRequest request = new LoginRequest("john@example.com", "Password@123");
        UserDto userDto = UserDto.builder()
                .id(UUID.randomUUID())
                .email("john@example.com")
                .role("ROLE_USER")
                .status(UserStatus.ACTIVE)
                .build();

        LoginResponse response = LoginResponse.builder()
                .accessToken("mock-access-token")
                .tokenType("Bearer")
                .expiresIn(900L)
                .user(userDto)
                .build();

        ResponseCookie cookie = ResponseCookie.from("refreshToken", "mock-refresh-token")
                .httpOnly(true)
                .path("/")
                .build();

        when(authService.login(any(LoginRequest.class))).thenReturn(new LoginResult(response, cookie));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").value("mock-access-token"))
                .andExpect(jsonPath("$.data.user.email").value("john@example.com"));

        verify(authService).login(any(LoginRequest.class));
    }

    @Test
    @DisplayName("Unit Test: refresh() returns 200 OK and new access token")
    void testRefreshToken() throws Exception {
        RefreshResponse response = RefreshResponse.builder()
                .accessToken("new-access-token")
                .build();

        ResponseCookie cookie = ResponseCookie.from("refreshToken", "rotated-refresh-token")
                .httpOnly(true)
                .path("/")
                .build();

        when(authService.refreshToken(nullable(String.class)))
                .thenReturn(new RefreshResult(response, cookie));

        mockMvc.perform(post("/api/auth/refresh"))
                .andExpect(status().isOk())
                .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").value("new-access-token"));

        verify(authService).refreshToken(nullable(String.class));
    }

    @Test
    @DisplayName("Unit Test: logout() returns 200 OK and clean cookie")
    void testLogout() throws Exception {
        ResponseCookie cleanCookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .maxAge(0)
                .path("/")
                .build();

        when(authService.logout(nullable(String.class))).thenReturn(cleanCookie);

        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isOk())
                .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Logged out of current device successfully"));

        verify(authService).logout(nullable(String.class));
    }

    @Test
    @DisplayName("Unit Test: logoutAll() returns 200 OK and clean cookie")
    void testLogoutAll() throws Exception {
        ResponseCookie cleanCookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .maxAge(0)
                .path("/")
                .build();

        when(authService.logoutAll(nullable(String.class), any())).thenReturn(cleanCookie);

        mockMvc.perform(post("/api/auth/logout-all"))
                .andExpect(status().isOk())
                .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Logged out of all devices successfully"));

        verify(authService).logoutAll(nullable(String.class), any());
    }
}
