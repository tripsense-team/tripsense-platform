package fu.tripsense.socialservice.dto.response;

public record SharedTripHighlightResponse(
        String title,
        String placeName,
        Integer dayNumber
) {
}
