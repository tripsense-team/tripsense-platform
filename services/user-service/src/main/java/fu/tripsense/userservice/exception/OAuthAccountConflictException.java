package fu.tripsense.userservice.exception;

public class OAuthAccountConflictException extends RuntimeException {
  public OAuthAccountConflictException(String message) {
    super(message);
  }
}
