package fu.tripsense.userservice.validator;

import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.enums.UserStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class UserValidator {

    public User validate(User user) {
        if (user == null || user.getStatus() != UserStatus.ACTIVE || !user.isEnabled()) {
            log.warn("User validation failed: User is null, inactive, or disabled");
            throw new BadCredentialsException("Invalid or expired refresh token");
        }

        return user;
    }
}
