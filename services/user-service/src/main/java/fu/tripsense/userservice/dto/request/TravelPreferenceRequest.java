package fu.tripsense.userservice.dto.request;

import jakarta.validation.constraints.Size;
import java.util.List;

public record TravelPreferenceRequest(
        boolean personalizationEnabled,
        @Size(max = 20) List<@Size(max = 80) String> preferredCategories,
        @Size(max = 20) List<@Size(max = 80) String> excludedCategories,
        @Size(max = 20) List<@Size(max = 80) String> dietaryTags,
        @Size(max = 20) List<@Size(max = 80) String> accessibilityNeeds,
        @Size(max = 20) List<@Size(max = 80) String> ambiencePreferences,
        @Size(max = 24) String pace,
        @Size(max = 24) String budgetLevel
) {
}
