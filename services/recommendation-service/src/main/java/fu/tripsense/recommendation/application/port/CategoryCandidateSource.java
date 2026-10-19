package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.domain.*;
import java.util.List;

public interface CategoryCandidateSource {
  Batch generateCategories(
      RecommendationContext context, List<DiscoveryCategory> categories, int target);

  record Batch(List<Group> groups) {}

  record Group(
      DiscoveryCategory category,
      String status,
      List<Candidate> candidates,
      List<String> degradations) {}
}
