package fu.tripsense.socialservice.dto.response;

import java.util.UUID;

public record TripShareDetailResponse(
    SocialPostResponse post,
    PublicTripSnapshotResponse publication,
    String detailAvailability,
    boolean canManagePublication,
    UUID sourceTripId) {}
