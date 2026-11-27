package fu.tripsense.recommendation.api.dto;

public record PlaceIndexItemResult(
    String placeId, Long sourceVersion, Status status, String errorCode) {
  public enum Status {
    INDEXED,
    UNCHANGED,
    RETRYABLE_FAILURE,
    PERMANENT_FAILURE
  }
}
