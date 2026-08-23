package fu.tripsense.tripservice.dto.response;

import java.io.Serializable;
import java.util.List;

public record TripListResponse(
        List<TripResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) implements Serializable {
}
