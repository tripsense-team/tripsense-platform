package fu.tripsense.contextservice.security;

import java.util.UUID;

public record AuthenticatedUser(UUID id, String email, String role) {}
