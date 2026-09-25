package fu.tripsense.recommendation.application.port;

public record FilterDecision(boolean accepted, String reason) {
  public static FilterDecision accept() {
    return new FilterDecision(true, null);
  }

  public static FilterDecision reject(String reason) {
    return new FilterDecision(false, reason);
  }
}
