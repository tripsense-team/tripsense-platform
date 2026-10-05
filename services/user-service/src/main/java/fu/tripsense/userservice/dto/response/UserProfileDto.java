package fu.tripsense.userservice.dto.response;

import java.util.Map;
import java.util.UUID;
import lombok.Builder;

@Builder
public record UserProfileDto(
    UUID userId,
    String email,
    String avatarUrl,
    String displayName,
    boolean onboardingRequired,
    String bio,
    String location,
    String coverUrl,
    Map<String, String> socialPorts) {}
