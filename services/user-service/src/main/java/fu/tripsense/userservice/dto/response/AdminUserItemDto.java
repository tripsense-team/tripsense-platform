package fu.tripsense.userservice.dto.response;

import java.time.Instant;
import java.util.UUID;

public record AdminUserItemDto(
    UUID id,
    String email,
    String displayName,
    String avatarUrl,
    String role,
    String status,
    String authProvider,
    boolean partnerEnrolled,
    boolean onboardingRequired,
    String location,
    Instant createdAt,
    Instant updatedAt) {}

