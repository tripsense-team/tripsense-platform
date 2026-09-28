package fu.tripsense.placeservice.security;

import java.util.UUID;

public record AuthenticatedUser(UUID id, String role) {}
