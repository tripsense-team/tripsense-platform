package fu.tripsense.userservice.exception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import fu.tripsense.userservice.dto.response.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

@ExtendWith(MockitoExtension.class)
class GlobalExceptionHandlerTest {

  private GlobalExceptionHandler exceptionHandler;

  @Mock private HttpServletRequest request;

  @BeforeEach
  void setUp() {
    exceptionHandler = new GlobalExceptionHandler();
    when(request.getRequestURI()).thenReturn("/api/auth/login");
  }

  @Test
  @DisplayName(
      "InternalAuthenticationServiceException should return 500 and NOT leak internal SQL error")
  void testInternalAuthenticationServiceExceptionDoesNotLeakSql() {
    String sensitiveSqlError =
        "JDBC exception executing SQL [ERROR: column u1_0.auth_provider does not exist Position: 16]";
    InternalAuthenticationServiceException ex =
        new InternalAuthenticationServiceException(
            sensitiveSqlError, new RuntimeException(sensitiveSqlError));

    ResponseEntity<ErrorResponse> response =
        exceptionHandler.handleInternalAuthenticationServiceException(ex, request);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().status()).isEqualTo(500);
    assertThat(response.getBody().message()).doesNotContain("JDBC");
    assertThat(response.getBody().message()).doesNotContain("auth_provider");
    assertThat(response.getBody().message())
        .isEqualTo("An unexpected error occurred during authentication. Please try again later.");
  }

  @Test
  @DisplayName("DataAccessException should return 500 and NOT leak database schema details")
  void testDataAccessExceptionSanitized() {
    DataIntegrityViolationException ex =
        new DataIntegrityViolationException("violates foreign key constraint fk_sessions_user_id");

    ResponseEntity<ErrorResponse> response =
        exceptionHandler.handleDataAccessException(ex, request);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().status()).isEqualTo(500);
    assertThat(response.getBody().message()).doesNotContain("fk_sessions_user_id");
    assertThat(response.getBody().message())
        .isEqualTo("A database error occurred. Please try again later.");
  }

  @Test
  @DisplayName("BadCredentialsException should return 401 with standard friendly message")
  void testBadCredentialsException() {
    BadCredentialsException ex = new BadCredentialsException("Bad credentials");

    ResponseEntity<ErrorResponse> response =
        exceptionHandler.handleBadCredentialsException(ex, request);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().status()).isEqualTo(401);
    assertThat(response.getBody().message()).isEqualTo("Invalid email or password");
  }

  @Test
  @DisplayName(
      "UsernameNotFoundException should return 401 with generic message (prevent user enumeration)")
  void testUsernameNotFoundException() {
    UsernameNotFoundException ex =
        new UsernameNotFoundException("User not found with email: hacker@target.com");

    ResponseEntity<ErrorResponse> response =
        exceptionHandler.handleUsernameNotFoundException(ex, request);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().status()).isEqualTo(401);
    assertThat(response.getBody().message()).isEqualTo("Invalid email or password");
  }

  @Test
  @DisplayName("DisabledException should return 403 Forbidden")
  void testDisabledException() {
    DisabledException ex = new DisabledException("User account is unverified");

    ResponseEntity<ErrorResponse> response = exceptionHandler.handleDisabledException(ex, request);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().status()).isEqualTo(403);
    assertThat(response.getBody().message())
        .isEqualTo("Your account has been deactivated or is unverified.");
  }

  @Test
  @DisplayName("LockedException should return 423 Locked")
  void testLockedException() {
    LockedException ex = new LockedException("Account locked");

    ResponseEntity<ErrorResponse> response = exceptionHandler.handleLockedException(ex, request);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.LOCKED);
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().status()).isEqualTo(423);
    assertThat(response.getBody().message())
        .isEqualTo("Your account is locked. Please contact support.");
  }

  @Test
  @DisplayName("OAuthAccountConflictException should return 409 Conflict with friendly message")
  void testOAuthAccountConflictException() {
    OAuthAccountConflictException ex =
        new OAuthAccountConflictException(
            "Tài khoản đã tồn tại trong hệ thống. Vui lòng đăng nhập bằng tài khoản thường.");

    ResponseEntity<ErrorResponse> response =
        exceptionHandler.handleOAuthAccountConflict(ex, request);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().status()).isEqualTo(409);
    assertThat(response.getBody().message())
        .isEqualTo(
            "Tài khoản đã tồn tại trong hệ thống. Vui lòng đăng nhập bằng tài khoản thường.");
  }
}
