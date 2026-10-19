package fu.tripsense.recommendation.api;

import fu.tripsense.recommendation.api.dto.*;
import fu.tripsense.recommendation.application.SectionFeedCommand;
import fu.tripsense.recommendation.application.SectionFeedService;
import fu.tripsense.recommendation.security.CurrentUserProvider;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/recommendations/explore-for-you/sections")
public class SectionFeedController {
  private final SectionFeedService service;
  private final CurrentUserProvider user;

  public SectionFeedController(SectionFeedService service, CurrentUserProvider user) {
    this.service = service;
    this.user = user;
  }

  @PostMapping
  public ApiResponse<SectionFeedResponse> recommend(
      @Valid @RequestBody SectionFeedRequest request) {
    return ApiResponse.success(
        SectionFeedResponse.from(
            service.recommend(
                user.user(),
                user.accessToken(),
                new SectionFeedCommand(
                    request.destinationId(),
                    request.sessionId(),
                    request.section(),
                    request.limit(),
                    request.seedId()))));
  }
}
