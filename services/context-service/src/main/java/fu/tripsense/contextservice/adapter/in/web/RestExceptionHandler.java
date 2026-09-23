package fu.tripsense.contextservice.adapter.in.web;

import fu.tripsense.contextservice.domain.VersionConflictException;
import fu.tripsense.contextservice.security.UnauthenticatedException;
import org.springframework.http.*;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
class RestExceptionHandler {
  @ExceptionHandler(VersionConflictException.class)
  ResponseEntity<ApiError> conflict(VersionConflictException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(new ApiError("VERSION_CONFLICT", ex.getMessage()));
  }

  @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
  ResponseEntity<ApiError> concurrentWrite(ObjectOptimisticLockingFailureException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(
            new ApiError(
                "VERSION_CONFLICT", "The onboarding profile was changed by another request"));
  }

  @ExceptionHandler({IllegalArgumentException.class, MethodArgumentNotValidException.class})
  ResponseEntity<ApiError> invalid(Exception ex) {
    return ResponseEntity.badRequest()
        .body(new ApiError("VALIDATION_FAILED", "The onboarding data is invalid"));
  }

  @ExceptionHandler(UnauthenticatedException.class)
  ResponseEntity<ApiError> unauthenticated(UnauthenticatedException ex) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(new ApiError("UNAUTHENTICATED", ex.getMessage()));
  }

  @ExceptionHandler(java.util.NoSuchElementException.class)
  ResponseEntity<ApiError> notFound(java.util.NoSuchElementException ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(new ApiError("NOT_FOUND", ex.getMessage()));
  }
}
