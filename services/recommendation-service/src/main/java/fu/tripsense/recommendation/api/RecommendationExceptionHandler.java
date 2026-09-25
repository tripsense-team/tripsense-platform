package fu.tripsense.recommendation.api;

import fu.tripsense.recommendation.api.dto.ApiResponse;
import fu.tripsense.recommendation.application.CandidateRetrievalUnavailableException;
import fu.tripsense.recommendation.application.FeedbackConflictException;
import fu.tripsense.recommendation.application.FeedbackValidationException;
import fu.tripsense.recommendation.application.TripContextNotAccessibleException;
import fu.tripsense.recommendation.application.TripContextUnavailableException;
import fu.tripsense.recommendation.security.UnauthenticatedException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class RecommendationExceptionHandler {
  @ExceptionHandler({
    IllegalArgumentException.class,
    MethodArgumentNotValidException.class,
    FeedbackValidationException.class
  })
  ResponseEntity<ApiResponse<Void>> invalid(Exception exception) {
    return ResponseEntity.badRequest()
        .body(
            ApiResponse.error(
                "INVALID_RECOMMENDATION_REQUEST", "The recommendation request is invalid"));
  }

  @ExceptionHandler(UnauthenticatedException.class)
  ResponseEntity<ApiResponse<Void>> unauthenticated(UnauthenticatedException exception) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(ApiResponse.error("UNAUTHENTICATED", "Authentication is required"));
  }

  @ExceptionHandler(FeedbackConflictException.class)
  ResponseEntity<ApiResponse<Void>> feedbackConflict(FeedbackConflictException exception) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(
            ApiResponse.error(
                "FEEDBACK_IDEMPOTENCY_CONFLICT",
                "The idempotency key was already used for different feedback"));
  }

  @ExceptionHandler(CandidateRetrievalUnavailableException.class)
  ResponseEntity<ApiResponse<Void>> retrievalUnavailable(
      CandidateRetrievalUnavailableException exception) {
    log.warn("Required recommendation candidate retrieval is unavailable");
    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .body(
            ApiResponse.error(
                "CANDIDATE_RETRIEVAL_UNAVAILABLE",
                "Place recommendations are temporarily unavailable"));
  }

  @ExceptionHandler(TripContextUnavailableException.class)
  ResponseEntity<ApiResponse<Void>> tripUnavailable(TripContextUnavailableException exception) {
    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .body(
            ApiResponse.error(
                "TRIP_CONTEXT_UNAVAILABLE", "Trip context is temporarily unavailable"));
  }

  @ExceptionHandler(TripContextNotAccessibleException.class)
  ResponseEntity<ApiResponse<Void>> tripNotAccessible(TripContextNotAccessibleException exception) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(ApiResponse.error("TRIP_NOT_FOUND", "Trip was not found"));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<ApiResponse<Void>> unexpected(Exception exception) {
    log.error("Unhandled recommendation failure", exception);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(ApiResponse.error("INTERNAL_ERROR", "An unexpected error occurred"));
  }
}
