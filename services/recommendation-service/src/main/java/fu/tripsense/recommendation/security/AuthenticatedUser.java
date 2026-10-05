package fu.tripsense.recommendation.security;

import java.util.UUID;

public record AuthenticatedUser(UUID id, String role) {}
