package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.domain.DiscoveryCategory;
import java.util.UUID;

public record SectionFeedCommand(
    String destinationId, String sessionId, DiscoveryCategory section, Integer limit, UUID seedId) {
  public int effectiveLimit() {
    return section == null ? 4 : limit == null ? 48 : limit;
  }
}
