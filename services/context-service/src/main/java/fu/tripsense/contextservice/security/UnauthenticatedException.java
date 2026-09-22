package fu.tripsense.contextservice.security;

public class UnauthenticatedException extends RuntimeException {
  public UnauthenticatedException() {
    super("Authentication is required");
  }
}
