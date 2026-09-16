package fu.tripsense.socialservice.exception;

import fu.tripsense.socialservice.dto.response.ErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    @ExceptionHandler(SocialException.class) ResponseEntity<ErrorResponse> social(SocialException e){ return ResponseEntity.status(e.status()).body(ErrorResponse.of(e.code(), e.getMessage())); }
    @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException e){ Map<String,Object> details=e.getBindingResult().getFieldErrors().stream().collect(Collectors.toMap(FieldError::getField, x -> x.getDefaultMessage()==null?"Invalid value":x.getDefaultMessage(),(a,b)->a)); return ResponseEntity.badRequest().body(ErrorResponse.of("VALIDATION_FAILED", "Validation failed", details)); }
    @ExceptionHandler(MethodArgumentTypeMismatchException.class) ResponseEntity<ErrorResponse> typeMismatch(MethodArgumentTypeMismatchException e){ return ResponseEntity.badRequest().body(ErrorResponse.of("VALIDATION_FAILED", "Invalid " + e.getName())); }
    @ExceptionHandler(Exception.class) ResponseEntity<ErrorResponse> unexpected(Exception e){
        log.error("Unexpected social-service error", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ErrorResponse.of("INTERNAL_ERROR", "An unexpected error occurred"));
    }
}
