package fu.tripsense.userservice.dto.response;

import org.springframework.http.ResponseCookie;

public record RefreshResult(RefreshResponse response, ResponseCookie cookie) {}
