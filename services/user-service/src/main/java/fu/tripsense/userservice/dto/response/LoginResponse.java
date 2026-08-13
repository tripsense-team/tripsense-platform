package fu.tripsense.userservice.dto.response;

import lombok.Builder;

@Builder
public record LoginResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        UserDto user
) {
}
