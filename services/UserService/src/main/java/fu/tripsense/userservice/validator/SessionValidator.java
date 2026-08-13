package fu.tripsense.userservice.validator;

import fu.tripsense.userservice.entity.Session;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@Slf4j
public class SessionValidator {

    public Session validate(Session session, LocalDateTime now) {
        if (session == null || session.getRevokedAt() != null) {
            log.warn("Session validation failed: Session is null or revoked");
            throw new BadCredentialsException("Invalid or expired refresh token");
        }

        if (session.getIdleExpiresAt().isBefore(now) || session.getAbsoluteExpiresAt().isBefore(now)) {
            log.warn("Session validation failed: Session idle or absolute timeout expired");
            throw new BadCredentialsException("Invalid or expired refresh token");
        }

        return session;
    }
}
