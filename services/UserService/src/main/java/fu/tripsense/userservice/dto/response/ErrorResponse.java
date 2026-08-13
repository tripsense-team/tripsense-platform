package fu.tripsense.userservice.dto.response;

import lombok.Builder;

import java.util.Date;

@Builder
public record ErrorResponse(
        Date timestamp,
        int status,
        String error,
        String message,
        String path
) {

    public static ErrorResponse of(int status, String error, String message, String path) {
        return new ErrorResponse(
                new Date(),
                status,
                error,
                message,
                path
        );
    }

    public static ErrorResponse of(int status, String error, String message) {
        return of(status, error, message, null);
    }
}
