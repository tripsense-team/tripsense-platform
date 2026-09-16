package fu.tripsense.userservice.controller;

import fu.tripsense.userservice.dto.request.UpdateProfileRequest;
import fu.tripsense.userservice.dto.response.UserProfileDto;
import fu.tripsense.userservice.dto.response.ApiResponse;
import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/profile/{userId}")
    public ResponseEntity<ApiResponse<UserProfileDto>> getUserProfile(@PathVariable UUID userId) {
        UserProfileDto profile = userService.getUserProfile(userId);
        return ResponseEntity.ok(ApiResponse.success(profile));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<UserProfileDto>> updateProfile(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody UpdateProfileRequest request) {
        UserProfileDto profile = userService.updateProfile(currentUser.getId(), request);
        return ResponseEntity.ok(ApiResponse.success(profile));
    }
}
