package fu.tripsense.contextservice.domain;

public final class VersionConflictException extends RuntimeException {
  public VersionConflictException() {
    super("The onboarding profile was changed by another request");
  }
}
