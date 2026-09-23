package fu.tripsense.userservice.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import fu.tripsense.userservice.dto.request.GoogleLoginRequest;
import fu.tripsense.userservice.dto.request.LoginRequest;
import fu.tripsense.userservice.dto.request.RegisterRequest;
import fu.tripsense.userservice.dto.response.LoginResult;
import fu.tripsense.userservice.dto.response.RefreshResult;
import fu.tripsense.userservice.dto.response.UserDto;
import fu.tripsense.userservice.entity.RefreshToken;
import fu.tripsense.userservice.entity.Session;
import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.entity.UserProfile;
import fu.tripsense.userservice.enums.UserStatus;
import fu.tripsense.userservice.exception.OAuthAccountConflictException;
import fu.tripsense.userservice.repository.EmailVerificationCodeRepository;
import fu.tripsense.userservice.repository.RefreshTokenRepository;
import fu.tripsense.userservice.repository.SessionRepository;
import fu.tripsense.userservice.repository.UserProfileRepository;
import fu.tripsense.userservice.repository.UserRepository;
import fu.tripsense.userservice.service.impl.AuthServiceImpl;
import fu.tripsense.userservice.util.CookieUtils;
import fu.tripsense.userservice.util.JwtUtils;
import fu.tripsense.userservice.validator.EmailVerificationValidator;
import fu.tripsense.userservice.validator.RefreshTokenValidator;
import fu.tripsense.userservice.validator.SessionValidator;
import fu.tripsense.userservice.validator.UserValidator;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseCookie;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

  @Mock private UserRepository userRepository;

  @Mock private UserProfileRepository userProfileRepository;

  @Mock private GoogleTokenVerifier googleTokenVerifier;

  @Mock private EmailVerificationCodeRepository emailVerificationCodeRepository;

  @Mock private SessionRepository sessionRepository;

  @Mock private RefreshTokenRepository refreshTokenRepository;

  @Mock private PasswordEncoder passwordEncoder;

  @Mock private AuthenticationManager authenticationManager;

  @Mock private JwtUtils jwtUtils;

  @Mock private CookieUtils cookieUtils;

  @Mock private VerificationService verificationService;

  @Mock private UserValidator userValidator;

  @Mock private EmailVerificationValidator emailVerificationValidator;

  @Mock private SessionValidator sessionValidator;

  @Mock private RefreshTokenValidator refreshTokenValidator;

  @InjectMocks private AuthServiceImpl authService;

  private User mockUser;
  private Session mockSession;
  private RefreshToken mockRefreshToken;

  @BeforeEach
  void setUp() {
    ReflectionTestUtils.setField(authService, "idleTimeoutDays", 7);
    ReflectionTestUtils.setField(authService, "absoluteTimeoutDays", 30);

    mockUser =
        User.builder()
            .id(UUID.randomUUID())
            .email("test@example.com")
            .password("encoded-pwd")
            .role("ROLE_USER")
            .status(UserStatus.ACTIVE)
            .build();

    mockSession =
        Session.builder()
            .id(UUID.randomUUID())
            .user(mockUser)
            .lastActivityAt(LocalDateTime.now())
            .idleExpiresAt(LocalDateTime.now().plusDays(7))
            .absoluteExpiresAt(LocalDateTime.now().plusDays(30))
            .build();

    mockRefreshToken =
        RefreshToken.builder()
            .id(UUID.randomUUID())
            .session(mockSession)
            .tokenHash("sample-hash")
            .expiresAt(LocalDateTime.now().plusDays(7))
            .build();
  }

  @Test
  @DisplayName("Unit Test: register() creates UNVERIFIED user and triggers email verification")
  void testRegister() {
    RegisterRequest request = new RegisterRequest("new@example.com", "Password@123");
    when(userRepository.findByEmail("new@example.com")).thenReturn(Optional.empty());
    when(passwordEncoder.encode(request.password())).thenReturn("hashed-pwd");
    when(userRepository.save(any(User.class))).thenReturn(mockUser);

    UserDto result = authService.register(request);

    assertNotNull(result);
    verify(emailVerificationValidator)
        .validateRegistrationEmail(Optional.empty(), "new@example.com");
    verify(userRepository).save(any(User.class));
    verify(verificationService).createAndSendVerificationCode(any(User.class));
  }

  @Test
  @DisplayName(
      "Unit Test: login() validates credentials, creates session & tokens, returns LoginResult")
  void testLogin() {
    LoginRequest request = new LoginRequest("test@example.com", "Password@123");
    Authentication authentication = mock(Authentication.class);
    when(authentication.getPrincipal()).thenReturn(mockUser);
    when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
        .thenReturn(authentication);

    when(sessionRepository.save(any(Session.class))).thenReturn(mockSession);
    when(refreshTokenRepository.save(any(RefreshToken.class))).thenReturn(mockRefreshToken);
    when(jwtUtils.generateRefreshToken(eq(mockUser), any(UUID.class), any(Date.class)))
        .thenReturn("refresh-token-123");
    when(jwtUtils.generateAccessToken(mockUser)).thenReturn("access-token-123");
    when(jwtUtils.getAccessTokenExpirationSeconds()).thenReturn(900L);
    when(cookieUtils.createRefreshTokenCookie(anyString(), anyLong()))
        .thenReturn(ResponseCookie.from("refreshToken", "cookie-val").build());

    LoginResult result = authService.login(request);

    assertNotNull(result);
    assertEquals("access-token-123", result.response().accessToken());
    assertEquals("test@example.com", result.response().user().email());
    verify(sessionRepository).save(any(Session.class));
    verify(refreshTokenRepository, atLeastOnce()).save(any(RefreshToken.class));
  }

  @Test
  @DisplayName("Unit Test: refreshToken() rotates tokens and updates session")
  void testRefreshToken() {
    when(refreshTokenValidator.validate(eq("raw-token"), any(LocalDateTime.class)))
        .thenReturn(mockRefreshToken);
    when(sessionValidator.validate(eq(mockSession), any(LocalDateTime.class)))
        .thenReturn(mockSession);
    when(userValidator.validate(eq(mockUser))).thenReturn(mockUser);
    when(sessionRepository.save(mockSession)).thenReturn(mockSession);
    when(refreshTokenRepository.save(any(RefreshToken.class))).thenReturn(mockRefreshToken);
    when(jwtUtils.generateRefreshToken(eq(mockUser), any(UUID.class), any(Date.class)))
        .thenReturn("rotated-token");
    when(jwtUtils.generateAccessToken(mockUser)).thenReturn("new-access-token");
    when(cookieUtils.createRefreshTokenCookie(anyString(), anyLong()))
        .thenReturn(ResponseCookie.from("refreshToken", "cookie-val").build());

    RefreshResult result = authService.refreshToken("raw-token");

    assertNotNull(result);
    assertEquals("new-access-token", result.response().getAccessToken());
    verify(sessionRepository).save(mockSession);
    verify(refreshTokenRepository, atLeastOnce()).save(any(RefreshToken.class));
  }

  @Test
  @DisplayName("Unit Test: logout() revokes current session and token")
  void testLogout() {
    when(refreshTokenRepository.findByTokenHash(anyString()))
        .thenReturn(Optional.of(mockRefreshToken));
    when(cookieUtils.cleanRefreshTokenCookie())
        .thenReturn(ResponseCookie.from("refreshToken", "").maxAge(0).build());

    ResponseCookie cookie = authService.logout("raw-token");

    assertNotNull(cookie);
    assertEquals(0, cookie.getMaxAge().getSeconds());
    assertNotNull(mockRefreshToken.getRevokedAt());
    assertNotNull(mockSession.getRevokedAt());
    verify(sessionRepository).save(mockSession);
    verify(refreshTokenRepository).save(mockRefreshToken);
  }

  @Test
  @DisplayName("Unit Test: logoutAll() with currentUser executes bulk revocation in DB")
  void testLogoutAllWithCurrentUser() {
    when(sessionRepository.revokeAllByUserId(eq(mockUser.getId()), any(LocalDateTime.class)))
        .thenReturn(2);
    when(refreshTokenRepository.revokeAllByUserId(eq(mockUser.getId()), any(LocalDateTime.class)))
        .thenReturn(2);
    when(cookieUtils.cleanRefreshTokenCookie())
        .thenReturn(ResponseCookie.from("refreshToken", "").maxAge(0).build());

    ResponseCookie cookie = authService.logoutAll(null, mockUser);

    assertNotNull(cookie);
    verify(sessionRepository).revokeAllByUserId(eq(mockUser.getId()), any(LocalDateTime.class));
    verify(refreshTokenRepository)
        .revokeAllByUserId(eq(mockUser.getId()), any(LocalDateTime.class));
  }

  @Test
  @DisplayName(
      "Unit Test: logoutAll() throws InsufficientAuthenticationException when unauthenticated")
  void testLogoutAllUnauthenticatedThrows() {
    assertThrows(
        InsufficientAuthenticationException.class,
        () -> {
          authService.logoutAll(null, null);
        });
    verifyNoInteractions(sessionRepository);
    verifyNoInteractions(refreshTokenRepository);
  }

  @Test
  @DisplayName("loginWithGoogle: when new user, should create user and return login result")
  void testLoginWithGoogle_NewUser() {
    GoogleLoginRequest request = new GoogleLoginRequest("valid-token");
    GoogleIdToken.Payload payload = new GoogleIdToken.Payload();
    payload.setEmail("newuser@gmail.com");
    payload.setSubject("google-sub-12345");
    payload.setEmailVerified(true);
    payload.set("picture", "https://avatar.url/pic.jpg");

    when(googleTokenVerifier.verify("valid-token")).thenReturn(payload);
    when(userRepository.findByEmail("newuser@gmail.com")).thenReturn(Optional.empty());

    when(userRepository.save(any(User.class)))
        .thenAnswer(
            invocation -> {
              User u = invocation.getArgument(0);
              u.setId(UUID.randomUUID());
              return u;
            });
    when(userProfileRepository.save(any(UserProfile.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    when(sessionRepository.save(any(Session.class))).thenReturn(mockSession);
    when(refreshTokenRepository.save(any(RefreshToken.class))).thenReturn(mockRefreshToken);
    when(jwtUtils.generateRefreshToken(any(), any(), any())).thenReturn("mock-raw-refresh-token");
    when(jwtUtils.generateAccessToken(any())).thenReturn("mock-access-token");
    when(jwtUtils.getAccessTokenExpirationSeconds()).thenReturn(900L);
    when(cookieUtils.createRefreshTokenCookie(anyString(), anyLong()))
        .thenReturn(ResponseCookie.from("refreshToken", "mock-raw-refresh-token").build());

    LoginResult result = authService.loginWithGoogle(request);

    assertNotNull(result);
    assertEquals("mock-access-token", result.response().accessToken());
    assertEquals("newuser@gmail.com", result.response().user().email());
    verify(userRepository).save(any(User.class));
    verify(userProfileRepository).save(any(UserProfile.class));
  }

  @Test
  @DisplayName(
      "loginWithGoogle: when existing user by email is standard account, should throw OAuthAccountConflictException")
  void testLoginWithGoogle_ExistingUser() {
    GoogleLoginRequest request = new GoogleLoginRequest("valid-token");
    GoogleIdToken.Payload payload = new GoogleIdToken.Payload();
    payload.setEmail(mockUser.getEmail());
    payload.setSubject("google-sub-12345");
    payload.setEmailVerified(true);
    payload.set("picture", "https://avatar.url/pic.jpg");

    when(googleTokenVerifier.verify("valid-token")).thenReturn(payload);
    when(userRepository.findByEmail(mockUser.getEmail())).thenReturn(Optional.of(mockUser));

    OAuthAccountConflictException ex =
        assertThrows(
            OAuthAccountConflictException.class, () -> authService.loginWithGoogle(request));
    assertEquals(
        "Tài khoản đã tồn tại trong hệ thống. Vui lòng đăng nhập bằng tài khoản thường.",
        ex.getMessage());
  }

  @Test
  @DisplayName(
      "loginWithGoogle: when existing user was registered via Google, should login successfully")
  void testLoginWithGoogle_ExistingGoogleUser() {
    User googleUser =
        User.builder()
            .id(UUID.randomUUID())
            .email("googleuser@gmail.com")
            .role("ROLE_USER")
            .status(UserStatus.ACTIVE)
            .authProvider("GOOGLE")
            .providerId("google-sub-12345")
            .build();

    GoogleLoginRequest request = new GoogleLoginRequest("valid-token");
    GoogleIdToken.Payload payload = new GoogleIdToken.Payload();
    payload.setEmail(googleUser.getEmail());
    payload.setSubject("google-sub-12345");
    payload.setEmailVerified(true);
    payload.set("picture", "https://avatar.url/pic.jpg");

    when(googleTokenVerifier.verify("valid-token")).thenReturn(payload);
    when(userRepository.findByEmail(googleUser.getEmail())).thenReturn(Optional.of(googleUser));
    when(userProfileRepository.findById(any())).thenReturn(Optional.empty());

    when(sessionRepository.save(any(Session.class))).thenReturn(mockSession);
    when(refreshTokenRepository.save(any(RefreshToken.class))).thenReturn(mockRefreshToken);
    when(jwtUtils.generateRefreshToken(any(), any(), any())).thenReturn("mock-raw-refresh-token");
    when(jwtUtils.generateAccessToken(any())).thenReturn("mock-access-token");
    when(jwtUtils.getAccessTokenExpirationSeconds()).thenReturn(900L);
    when(cookieUtils.createRefreshTokenCookie(anyString(), anyLong()))
        .thenReturn(ResponseCookie.from("refreshToken", "mock-raw-refresh-token").build());

    LoginResult result = authService.loginWithGoogle(request);

    assertNotNull(result);
    assertEquals("mock-access-token", result.response().accessToken());
  }

  @Test
  @DisplayName("loginWithGoogle: when user is INACTIVE, throws BadCredentialsException")
  void testLoginWithGoogle_InactiveUser() {
    GoogleLoginRequest request = new GoogleLoginRequest("valid-token");
    GoogleIdToken.Payload payload = new GoogleIdToken.Payload();
    payload.setEmail("inactive@gmail.com");
    payload.setSubject("google-sub-12345");

    User inactiveUser =
        User.builder()
            .id(UUID.randomUUID())
            .email("inactive@gmail.com")
            .status(UserStatus.INACTIVE)
            .authProvider("GOOGLE")
            .providerId("google-sub-12345")
            .build();

    when(googleTokenVerifier.verify("valid-token")).thenReturn(payload);
    when(userRepository.findByEmail("inactive@gmail.com")).thenReturn(Optional.of(inactiveUser));

    assertThrows(BadCredentialsException.class, () -> authService.loginWithGoogle(request));
  }
}
