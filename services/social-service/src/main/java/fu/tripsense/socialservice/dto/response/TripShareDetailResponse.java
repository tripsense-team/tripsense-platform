package fu.tripsense.socialservice.dto.response;

public record TripShareDetailResponse(
        SocialPostResponse post,
        boolean canOpenTrip,
        String tripUnavailableReason
) {
}
