package fu.tripsense.placeservice.routes;

import java.util.List;

public final class RouteModels {

    private RouteModels() {
    }

    public record RouteRequest(LatLng origin, LatLng destination, String mode) {
    }

    public record LatLng(double latitude, double longitude) {
    }

    public record RouteResponse(double distanceMeters, long durationSeconds, List<LatLng> geometry) {
    }
}
