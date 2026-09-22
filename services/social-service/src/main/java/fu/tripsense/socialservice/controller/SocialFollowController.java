package fu.tripsense.socialservice.controller;

import fu.tripsense.socialservice.dto.response.ApiResponse;
import fu.tripsense.socialservice.dto.response.FollowResponse;
import fu.tripsense.socialservice.security.CurrentUserProvider;
import fu.tripsense.socialservice.service.SocialFollowService;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/social")
@RequiredArgsConstructor
public class SocialFollowController {

  private final SocialFollowService followService;
  private final CurrentUserProvider currentUser;

  @PostMapping({"/users/{targetUserId}/follow", "/follows/{targetUserId}"})
  public ApiResponse<FollowResponse> followUserPost(@PathVariable UUID targetUserId) {
    FollowResponse response = followService.followUser(currentUser.requiredUser(), targetUserId);
    return ApiResponse.success("User followed", response);
  }

  @PutMapping({"/users/{targetUserId}/follow", "/follows/{targetUserId}"})
  public ApiResponse<FollowResponse> followUserPut(@PathVariable UUID targetUserId) {
    FollowResponse response = followService.followUser(currentUser.requiredUser(), targetUserId);
    return ApiResponse.success("User followed", response);
  }

  @DeleteMapping({"/users/{targetUserId}/follow", "/follows/{targetUserId}"})
  public ApiResponse<FollowResponse> unfollowUser(@PathVariable UUID targetUserId) {
    FollowResponse response = followService.unfollowUser(currentUser.requiredUser(), targetUserId);
    return ApiResponse.success("User unfollowed", response);
  }

  @GetMapping({"/users/{targetUserId}/follow", "/follows/{targetUserId}"})
  public ApiResponse<FollowResponse> getFollowStatus(@PathVariable UUID targetUserId) {
    FollowResponse response =
        followService.getFollowStatus(currentUser.optionalUser().orElse(null), targetUserId);
    return ApiResponse.success(response);
  }
}
