package fu.tripsense.recommendation.application;

public record PlaceIndexResult(
    String placeId, Long sourceVersion, Status status, String errorCode) {
  public enum Status {
    INDEXED,
    UNCHANGED,
    RETRYABLE_FAILURE,
    PERMANENT_FAILURE
  }
}
