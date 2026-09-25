package fu.tripsense.socialservice.exception;

import fu.tripsense.socialservice.dto.response.ErrorResponse;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

  @ExceptionHandler(SocialException.class)
  public ResponseEntity<ErrorResponse> social(SocialException e) {
    return ResponseEntity.status(e.status())
        .contentType(MediaType.APPLICATION_JSON)
        .body(ErrorResponse.of(e.code(), e.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException e) {
    Map<String, Object> details =
        e.getBindingResult().getFieldErrors().stream()
            .collect(
                Collectors.toMap(
                    FieldError::getField,
                    x -> x.getDefaultMessage() == null ? "Invalid value" : x.getDefaultMessage(),
                    (a, b) -> a));
    return ResponseEntity.badRequest()
        .contentType(MediaType.APPLICATION_JSON)
        .body(ErrorResponse.of("VALIDATION_FAILED", "Validation failed", details));
  }

  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  public ResponseEntity<ErrorResponse> typeMismatch(MethodArgumentTypeMismatchException e) {
    return ResponseEntity.badRequest()
        .contentType(MediaType.APPLICATION_JSON)
        .body(ErrorResponse.of("VALIDATION_FAILED", "Invalid " + e.getName()));
  }

  @ExceptionHandler(NoResourceFoundException.class)
  public ResponseEntity<ErrorResponse> noResourceFound(NoResourceFoundException e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .contentType(MediaType.APPLICATION_JSON)
        .body(ErrorResponse.of("RESOURCE_NOT_FOUND", "Resource not found: " + e.getResourcePath()));
  }
  @ExceptionHandler(Exception.class)
  public ResponseEntity<ErrorResponse> unexpected(Exception e) {
    log.error("Unexpected social-service error", e);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .contentType(MediaType.APPLICATION_JSON)
        .body(ErrorResponse.of("INTERNAL_ERROR", "An unexpected error occurred"));
  }
}


