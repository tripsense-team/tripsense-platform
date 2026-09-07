package fu.tripsense.tripservice.dto.response;

public record TripShareHighlightResponse(
        String title,
        String placeName,
        Integer dayNumber
) {
}
