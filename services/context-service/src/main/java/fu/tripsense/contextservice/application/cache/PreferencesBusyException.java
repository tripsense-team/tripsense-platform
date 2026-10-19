package fu.tripsense.contextservice.application.cache;

public class PreferencesBusyException extends RuntimeException {
  public PreferencesBusyException() {
    super("Preferences are temporarily unavailable");
  }
}
