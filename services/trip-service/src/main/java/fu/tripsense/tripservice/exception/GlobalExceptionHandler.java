package fu.tripsense.tripservice.exception;

import fu.tripsense.tripservice.dto.response.ErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(TripServiceException.class)
    ResponseEntity<ErrorResponse> handleTripServiceException(TripServiceException ex) {
        if (ex.status().is5xxServerError()) {
            log.error("{}: {}", ex.code(), ex.getMessage());
        } else {
            log.warn("{}: {}", ex.code(), ex.getMessage());
        }
        return ResponseEntity.status(ex.status()).body(ErrorResponse.of(ex.code(), ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, Object> details = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        error -> error.getDefaultMessage() == null ? "Invalid value" : error.getDefaultMessage(),
                        (left, right) -> left
                ));
        return ResponseEntity.badRequest().body(ErrorResponse.of("VALIDATION_FAILED", "Validation failed", details));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
        log.error("Unhandled trip-service exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.of("INTERNAL_ERROR", "An unexpected error occurred"));
    }
}
