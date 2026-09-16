package fu.tripsense.userservice.dto.request;

import jakarta.validation.constraints.Size;
import java.util.Map;

public record UpdateProfileRequest(
        String avatarUrl,
        @Size(max = 1000)
        String bio,
        @Size(max = 255)
        String location,
        String coverUrl,
        Map<String, String> socialPorts
) {
}
