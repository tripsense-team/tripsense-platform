package fu.tripsense.userservice.dto.response;

import org.springframework.http.ResponseCookie;

public record LoginResult(
        LoginResponse response,
        ResponseCookie cookie
) {
}
