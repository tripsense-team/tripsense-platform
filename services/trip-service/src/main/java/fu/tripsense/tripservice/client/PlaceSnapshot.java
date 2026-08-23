package fu.tripsense.tripservice.client;

import java.math.BigDecimal;
import java.util.UUID;

public record PlaceSnapshot(
        UUID id,
        String name,
        String address,
        BigDecimal latitude,
        BigDecimal longitude
) {
}
