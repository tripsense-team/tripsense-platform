package fu.tripsense.userservice.controller;

import fu.tripsense.userservice.dto.request.ResendCodeRequest;
import fu.tripsense.userservice.dto.request.VerifyEmailRequest;
import fu.tripsense.userservice.dto.response.ApiResponse;
import fu.tripsense.userservice.dto.response.UserDto;
import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.service.VerificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/auth"})
@RequiredArgsConstructor
public class VerificationController {

    private final VerificationService verificationService;

    @PostMapping("/verify-email")
    public ResponseEntity<ApiResponse<UserDto>> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        User user = verificationService.verifyEmailCode(request.email(), request.code());
        UserDto userDto = UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .role(user.getRole())
                .status(user.getStatus())
                .build();
        return ResponseEntity.ok(ApiResponse.success("Email verified successfully", userDto));
    }

    @PostMapping("/resend-code")
    public ResponseEntity<ApiResponse<Void>> resendCode(@Valid @RequestBody ResendCodeRequest request) {
        verificationService.resendVerificationCode(request.email());
        return ResponseEntity.ok(ApiResponse.success("Verification code resent successfully", null));
    }
}
