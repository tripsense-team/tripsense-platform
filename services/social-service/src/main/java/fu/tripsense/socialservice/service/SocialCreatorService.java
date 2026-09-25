package fu.tripsense.socialservice.service;

import fu.tripsense.socialservice.dto.response.SuggestedCreatorResponse;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import java.util.List;

public interface SocialCreatorService {

  List<SuggestedCreatorResponse> getSuggestedCreators(
      AuthenticatedUser currentUserOrNull, int limit);
}
