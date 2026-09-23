package fu.tripsense.userservice.dto.response;

import fu.tripsense.userservice.enums.UserStatus;
import java.util.UUID;
import lombok.Builder;

@Builder
public record UserDto(UUID id, String email, String role, UserStatus status) {}
