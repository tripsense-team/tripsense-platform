package fu.tripsense.tripservice.dto.response;

import java.util.List;

public record TripPlacePageResponse(
    List<TripPlaceResponse> content,
    long totalElements,
    int totalPages,
    int size,
    int page) {}
