package fu.tripsense.userservice.controller;

import fu.tripsense.userservice.dto.request.PublicProfileBatchRequest;
import fu.tripsense.userservice.dto.request.TravelPreferenceRequest;
import fu.tripsense.userservice.dto.request.UpdateProfileRequest;
import fu.tripsense.userservice.dto.response.ApiResponse;
import fu.tripsense.userservice.dto.response.OnboardingGateDto;
import fu.tripsense.userservice.dto.response.PublicProfileDto;
import fu.tripsense.userservice.dto.response.TravelPreferenceDto;
import fu.tripsense.userservice.dto.response.UserProfileDto;
import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.service.TravelPreferenceService;
import fu.tripsense.userservice.service.UserService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

  private final UserService userService;
  private final TravelPreferenceService travelPreferenceService;

  @GetMapping("/profile/{userId}")
  public ResponseEntity<ApiResponse<UserProfileDto>> getUserProfile(@PathVariable UUID userId) {
    UserProfileDto profile = userService.getUserProfile(userId);
    return ResponseEntity.ok(ApiResponse.success(profile));
  }

  @GetMapping("/public-profiles/{userId}")
  public ResponseEntity<ApiResponse<PublicProfileDto>> getPublicProfile(@PathVariable UUID userId) {
    return ResponseEntity.ok(ApiResponse.success(userService.getPublicProfile(userId)));
  }

  @PostMapping("/public-profiles:batch")
  public ResponseEntity<ApiResponse<List<PublicProfileDto>>> getPublicProfiles(
      @Valid @RequestBody PublicProfileBatchRequest request) {
    return ResponseEntity.ok(ApiResponse.success(userService.getPublicProfiles(request.userIds())));
  }

  @PutMapping("/profile")
  public ResponseEntity<ApiResponse<UserProfileDto>> updateProfile(
      @AuthenticationPrincipal User currentUser, @Valid @RequestBody UpdateProfileRequest request) {
    UserProfileDto profile = userService.updateProfile(currentUser.getId(), request);
    return ResponseEntity.ok(ApiResponse.success(profile));
  }

  @PostMapping("/profile/onboarding-complete")
  public ResponseEntity<ApiResponse<Void>> markOnboardingComplete(
      @AuthenticationPrincipal User currentUser) {
    userService.markOnboardingComplete(currentUser.getId());
    return ResponseEntity.ok(ApiResponse.success(null));
  }

  @GetMapping("/me/onboarding-gate")
  public ResponseEntity<ApiResponse<OnboardingGateDto>> getOnboardingGate(
      @AuthenticationPrincipal User currentUser) {
    return ResponseEntity.ok(
        ApiResponse.success(userService.getOnboardingGate(currentUser.getId())));
  }

  @GetMapping("/me/travel-preferences")
  public ResponseEntity<ApiResponse<TravelPreferenceDto>> getTravelPreferences(
      @AuthenticationPrincipal User currentUser) {
    return ResponseEntity.ok(
        ApiResponse.success(travelPreferenceService.get(currentUser.getId())));
  }

  @PutMapping("/me/travel-preferences")
  public ResponseEntity<ApiResponse<TravelPreferenceDto>> updateTravelPreferences(
      @AuthenticationPrincipal User currentUser,
      @Valid @RequestBody TravelPreferenceRequest request) {
    return ResponseEntity.ok(
        ApiResponse.success(travelPreferenceService.update(currentUser.getId(), request)));
  }

  @DeleteMapping("/me/travel-preferences")
  public ResponseEntity<ApiResponse<TravelPreferenceDto>> resetTravelPreferences(
      @AuthenticationPrincipal User currentUser) {
    return ResponseEntity.ok(
        ApiResponse.success(travelPreferenceService.reset(currentUser.getId())));
  }
}

