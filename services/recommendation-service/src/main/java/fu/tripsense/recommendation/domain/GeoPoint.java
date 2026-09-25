package fu.tripsense.recommendation.domain;

public record GeoPoint(double lat, double lng) {
  public GeoPoint {
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new IllegalArgumentException("Invalid geographic coordinates");
    }
  }
}
