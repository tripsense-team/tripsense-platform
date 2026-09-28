package fu.tripsense.placeservice.controller;

import fu.tripsense.placeservice.dto.ApiResponse;
import fu.tripsense.placeservice.providers.PlaceProviderException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(MissingServletRequestParameterException.class)
  public ResponseEntity<ApiResponse<Void>> handleMissingParams(
      MissingServletRequestParameterException ex) {
    return ResponseEntity.badRequest()
        .body(
            ApiResponse.error(
                "MISSING_PARAMETER",
                "Required parameter '" + ex.getParameterName() + "' is missing"));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
    return ResponseEntity.badRequest().body(ApiResponse.error("INVALID_ARGUMENT", ex.getMessage()));
  }

  @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
  public ResponseEntity<ApiResponse<Void>> handleNoResourceFound(
      org.springframework.web.servlet.resource.NoResourceFoundException ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(ApiResponse.error("RESOURCE_NOT_FOUND", ex.getMessage()));
  }

  @ExceptionHandler(org.apache.catalina.connector.ClientAbortException.class)
  public void handleClientAbort(org.apache.catalina.connector.ClientAbortException ex) {
    log.debug("Client closed connection prematurely: {}", ex.getMessage());
  }

  @ExceptionHandler(java.io.IOException.class)
  public void handleIoException(java.io.IOException ex) {
    String msg = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
    if (msg.contains("broken pipe") || msg.contains("connection reset")) {
      log.debug("Client socket closed before response finished: {}", ex.getMessage());
      return;
    }
    log.warn("I/O error occurred: {}", ex.getMessage());
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiResponse<Void>> handleGeneralException(Exception ex) {
    log.error("Unhandled exception occurred: ", ex);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(
            ApiResponse.error(
                "INTERNAL_ERROR", "An unexpected error occurred while processing your request"));
  }

  @ExceptionHandler(PlaceProviderException.class)
  public ResponseEntity<ApiResponse<Void>> handleProviderUnavailable(PlaceProviderException ex) {
    log.warn("External place provider unavailable: {}", ex.getMessage());
    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .body(
            ApiResponse.error(
                "SERVICE_UNAVAILABLE", "Place data provider is temporarily unavailable"));
  }
}
