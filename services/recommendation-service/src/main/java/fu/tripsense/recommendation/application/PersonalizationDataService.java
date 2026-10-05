package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.application.port.PersonalizationDataEraser;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class PersonalizationDataService {
  private final PersonalizationDataEraser dataEraser;

  public PersonalizationDataService(PersonalizationDataEraser dataEraser) {
    this.dataEraser = dataEraser;
  }

  public void erase(UUID userId) {
    dataEraser.erase(userId);
  }
}
