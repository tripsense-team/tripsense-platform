package fu.tripsense.recommendation.application.port;

import java.util.UUID;

public interface PersonalizationDataEraser {
  void erase(UUID userId);
}
