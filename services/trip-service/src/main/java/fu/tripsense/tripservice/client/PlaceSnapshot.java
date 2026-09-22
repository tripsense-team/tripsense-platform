package fu.tripsense.tripservice.client;

import java.math.BigDecimal;

public record PlaceSnapshot(
    String id,
    String name,
    String address,
    BigDecimal latitude,
    BigDecimal longitude) {}
