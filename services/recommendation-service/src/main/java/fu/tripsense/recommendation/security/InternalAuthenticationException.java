package fu.tripsense.recommendation.security;

public class InternalAuthenticationException extends RuntimeException {
  public InternalAuthenticationException() {
    super("Internal service authentication failed");
  }
}
