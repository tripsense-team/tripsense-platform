package fu.tripsense.placeservice.exception;

import org.springframework.http.HttpStatus;

public class PlaceActionException extends RuntimeException {
  private final HttpStatus status;
  private final String code;

  public PlaceActionException(HttpStatus status, String code, String message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  public HttpStatus status() {
    return status;
  }

  public String code() {
    return code;
  }
}
