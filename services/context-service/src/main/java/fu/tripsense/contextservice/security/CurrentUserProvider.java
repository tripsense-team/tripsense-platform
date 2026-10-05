package fu.tripsense.contextservice.security;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class CurrentUserProvider {
  public AuthenticatedUser requiredUser() {
    Object principal =
        SecurityContextHolder.getContext().getAuthentication() == null
            ? null
            : SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    if (principal instanceof AuthenticatedUser user) return user;
    throw new UnauthenticatedException();
  }
}
