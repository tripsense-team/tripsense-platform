package fu.tripsense.recommendation.algorithm.feature;

import fu.tripsense.recommendation.domain.GeoPoint;
import org.springframework.stereotype.Component;

@Component
public class GeoDistanceCalculator {
  private static final double EARTH_RADIUS_KM = 6371.0088;

  public double kilometers(GeoPoint first, GeoPoint second) {
    double latitude = Math.toRadians(second.lat() - first.lat());
    double longitude = Math.toRadians(second.lng() - first.lng());
    double value =
        Math.sin(latitude / 2) * Math.sin(latitude / 2)
            + Math.cos(Math.toRadians(first.lat()))
                * Math.cos(Math.toRadians(second.lat()))
                * Math.sin(longitude / 2)
                * Math.sin(longitude / 2);
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
  }

  public double exponentialDecay(double distanceKm, double tauKm) {
    if (distanceKm < 0) throw new IllegalArgumentException("distance cannot be negative");
    if (tauKm <= 0) throw new IllegalArgumentException("distance tau must be positive");
    return Math.exp(-distanceKm / tauKm);
  }
}
