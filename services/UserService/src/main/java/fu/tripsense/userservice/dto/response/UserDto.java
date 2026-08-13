package fu.tripsense.userservice.dto.response;

import fu.tripsense.userservice.enums.UserStatus;
import lombok.Builder;

import java.util.UUID;

@Builder
public record UserDto(
        UUID id,
        String email,
        String role,
        UserStatus status
) {
}
