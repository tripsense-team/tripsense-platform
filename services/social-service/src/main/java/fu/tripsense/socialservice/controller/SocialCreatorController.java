package fu.tripsense.socialservice.controller;

import fu.tripsense.socialservice.dto.response.ApiResponse;
import fu.tripsense.socialservice.dto.response.SuggestedCreatorResponse;
import fu.tripsense.socialservice.security.CurrentUserProvider;
import fu.tripsense.socialservice.service.SocialCreatorService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/social")
@RequiredArgsConstructor
public class SocialCreatorController {

  private final SocialCreatorService creatorService;
  private final CurrentUserProvider currentUser;

  @GetMapping({"/creators/suggested", "/creator-suggestions"})
  public ApiResponse<List<SuggestedCreatorResponse>> getSuggestedCreators(
      @RequestParam(defaultValue = "4") int limit) {
    List<SuggestedCreatorResponse> response =
        creatorService.getSuggestedCreators(currentUser.optionalUser().orElse(null), limit);
    return ApiResponse.success(response);
  }
}
