package fu.tripsense.socialservice.security;

import fu.tripsense.socialservice.exception.SocialException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import java.util.Optional;

@Component
public class CurrentUserProvider {
    public AuthenticatedUser requiredUser() { return optionalUser().orElseThrow(() -> new SocialException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Authentication is required")); }
    public Optional<AuthenticatedUser> optionalUser() { Authentication a = SecurityContextHolder.getContext().getAuthentication(); return a != null && a.getPrincipal() instanceof AuthenticatedUser u ? Optional.of(u) : Optional.empty(); }
}
