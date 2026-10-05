package fu.tripsense.tripservice.security;

import fu.tripsense.tripservice.exception.UnauthenticatedException;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class CurrentUserProvider {

  public AuthenticatedUser get() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null
        || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) {
      throw new UnauthenticatedException();
    }
    return user;
  }

  public UUID userId() {
    return get().id();
  }

  public String userEmail() {
    return get().email();
  }
}
