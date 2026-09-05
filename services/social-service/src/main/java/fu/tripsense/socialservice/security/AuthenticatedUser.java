package fu.tripsense.socialservice.security;

import java.util.UUID;
public record AuthenticatedUser(UUID id, String email, String role) { }
