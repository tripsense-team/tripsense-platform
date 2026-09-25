package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.domain.UserProfileSnapshot;
import java.util.UUID;

public interface ObservedHistoryReader {
  UserProfileSnapshot read(UUID userId, boolean personalizationEnabled);
}
