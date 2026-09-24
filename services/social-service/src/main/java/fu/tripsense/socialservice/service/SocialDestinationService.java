package fu.tripsense.socialservice.service;

import fu.tripsense.socialservice.dto.response.TrendingDestinationResponse;
import java.util.List;

public interface SocialDestinationService {

  List<TrendingDestinationResponse> getTrendingDestinations(int limit);
}
