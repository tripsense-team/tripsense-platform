package fu.tripsense.userservice.controller;

import fu.tripsense.userservice.dto.request.LoginRequest;
import fu.tripsense.userservice.dto.request.RegisterRequest;
import fu.tripsense.userservice.dto.response.ApiResponse;
import fu.tripsense.userservice.dto.response.LoginResponse;
import fu.tripsense.userservice.dto.response.LoginResult;
import fu.tripsense.userservice.dto.response.RefreshResponse;
import fu.tripsense.userservice.dto.response.RefreshResult;
import fu.tripsense.userservice.dto.response.UserDto;
import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/auth"})
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<UserDto>> register(@Valid @RequestBody RegisterRequest request) {
        UserDto user = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Registration successful. Please check your email for the verification code.", user));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        LoginResult result = authService.login(request);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, result.cookie().toString())
                .body(ApiResponse.success("Login successful", result.response()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<RefreshResponse>> refreshToken(
            @CookieValue(name = "${jwt.refresh-token-cookie-name}", required = false) String refreshToken) {
        RefreshResult result = authService.refreshToken(refreshToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, result.cookie().toString())
                .body(ApiResponse.success("Access token refreshed successfully", result.response()));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @CookieValue(name = "${jwt.refresh-token-cookie-name}", required = false) String refreshToken) {
        ResponseCookie cookie = authService.logout(refreshToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(ApiResponse.success("Logged out of current device successfully", null));
    }

    @PostMapping("/logout-all")
    public ResponseEntity<ApiResponse<Void>> logoutAll(
            @CookieValue(name = "${jwt.refresh-token-cookie-name}", required = false) String refreshToken,
            @AuthenticationPrincipal User currentUser) {
        ResponseCookie cookie = authService.logoutAll(refreshToken, currentUser);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(ApiResponse.success("Logged out of all devices successfully", null));
    }
}
