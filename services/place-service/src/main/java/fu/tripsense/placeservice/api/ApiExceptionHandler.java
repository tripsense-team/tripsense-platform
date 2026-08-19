package fu.tripsense.placeservice.api;

import fu.tripsense.placeservice.providers.ProviderException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.Instant;
import java.util.Map;

@RestControllerAdvice
class ApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ErrorResponse> validation(IllegalArgumentException exception, HttpServletRequest request) {
        return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", exception.getMessage(), request, Map.of());
    }

    @ExceptionHandler({MethodArgumentTypeMismatchException.class, MethodArgumentNotValidException.class})
    ResponseEntity<ErrorResponse> malformed(Exception exception, HttpServletRequest request) {
        return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Invalid request parameters.", request, Map.of());
    }

    @ExceptionHandler(ProviderException.class)
    ResponseEntity<ErrorResponse> provider(ProviderException exception, HttpServletRequest request) {
        HttpStatus status = switch (exception.kind()) {
            case MISSING_CONFIGURATION -> HttpStatus.SERVICE_UNAVAILABLE;
            case UNAUTHORIZED -> HttpStatus.UNAUTHORIZED;
            case FORBIDDEN -> HttpStatus.FORBIDDEN;
            case RATE_LIMITED, UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case BAD_REQUEST -> HttpStatus.BAD_REQUEST;
        };
        return error(status, exception.code(), exception.getMessage(), request, exception.details());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(Exception exception, HttpServletRequest request) {
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Unexpected place-service error.", request, Map.of());
    }

    private static ResponseEntity<ErrorResponse> error(
            HttpStatus status,
            String code,
            String message,
            HttpServletRequest request,
            Map<String, Object> details
    ) {
        String requestId = request.getHeader("X-Request-Id");
        if (requestId == null || requestId.isBlank()) {
            requestId = "local";
        }
        return ResponseEntity.status(status).body(new ErrorResponse(
                new ErrorBody(code, message, details, requestId, Instant.now().toString())
        ));
    }

    record ErrorResponse(ErrorBody error) {
    }

    record ErrorBody(String code, String message, Map<String, Object> details, String requestId, String timestamp) {
    }
}
