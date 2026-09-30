package fu.tripsense.placeservice.dto;

import java.util.List;

public record SavedPlacesPage(
    List<SavedPlaceDto> content,
    long totalElements,
    int totalPages,
    int size,
    int page) {}
