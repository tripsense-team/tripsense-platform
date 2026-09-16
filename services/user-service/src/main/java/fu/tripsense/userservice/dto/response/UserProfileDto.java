package fu.tripsense.userservice.dto.response;

import lombok.Builder;

import java.util.Map;
import java.util.UUID;

@Builder
public record UserProfileDto(
        UUID userId,
        String email,
        String avatarUrl,
        String bio,
        String location,
        String coverUrl,
        Map<String, String> socialPorts
) {
}
