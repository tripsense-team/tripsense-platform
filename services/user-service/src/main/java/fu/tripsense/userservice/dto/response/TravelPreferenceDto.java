package fu.tripsense.userservice.dto.response;

import java.time.Instant;
import java.util.Map;

public record TravelPreferenceDto(
        boolean personalizationEnabled,
        Map<String, Object> preferences,
        Instant consentedAt,
        Long version,
        Instant updatedAt
) {
}
