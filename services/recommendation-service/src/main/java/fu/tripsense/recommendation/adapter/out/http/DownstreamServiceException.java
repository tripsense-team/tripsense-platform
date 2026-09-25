package fu.tripsense.recommendation.adapter.out.http;

public class DownstreamServiceException extends RuntimeException {
  private final String dependency;

  public DownstreamServiceException(String dependency, Throwable cause) {
    super(dependency + " is unavailable", cause);
    this.dependency = dependency;
  }

  public String dependency() {
    return dependency;
  }
}
