package fu.tripsense.tripservice.security;

import java.util.List;
import java.util.UUID;

public record AuthenticatedUser(UUID id, String email, String role, List<String> roles) {
  public AuthenticatedUser(UUID id, String email, String role) {
    this(id, email, role, role != null ? List.of(role) : List.of("ROLE_USER"));
  }

  public boolean hasRole(String targetRole) {
    if (targetRole == null) return false;
    String normalized = targetRole.startsWith("ROLE_") ? targetRole : "ROLE_" + targetRole;
    if (role != null && (role.equals(targetRole) || role.equals(normalized))) {
      return true;
    }
    if (roles != null) {
      for (String r : roles) {
        if (r != null && (r.equals(targetRole) || r.equals(normalized))) {
          return true;
        }
      }
    }
    return false;
  }

  public boolean isAdmin() {
    return hasRole("ROLE_ADMIN");
  }

  public boolean isPartner() {
    return hasRole("ROLE_PARTNER");
  }
}
