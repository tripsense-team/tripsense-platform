package fu.tripsense.tripservice.exception;

import org.springframework.http.HttpStatus;

public class ForbiddenException extends TripServiceException {

  public ForbiddenException(String code, String message) {
    super(code, message, HttpStatus.FORBIDDEN);
  }
}
