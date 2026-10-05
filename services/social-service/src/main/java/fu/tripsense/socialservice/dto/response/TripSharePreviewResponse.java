package fu.tripsense.socialservice.dto.response;

import java.util.List;

public record TripSharePreviewResponse(
    PublicTripSnapshotResponse snapshot,
    String snapshotFingerprint,
    String consentVersion,
    List<String> warnings) {}
