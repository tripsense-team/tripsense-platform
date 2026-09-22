package fu.tripsense.userservice.service;

import fu.tripsense.userservice.dto.request.TravelPreferenceRequest;
import fu.tripsense.userservice.dto.response.TravelPreferenceDto;
import java.util.UUID;

public interface TravelPreferenceService {
    TravelPreferenceDto get(UUID userId);
    TravelPreferenceDto update(UUID userId, TravelPreferenceRequest request);
    TravelPreferenceDto reset(UUID userId);
}
