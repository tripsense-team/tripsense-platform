package fu.tripsense.tripservice.dto.response;

import java.util.List;

public record PublicTripPublicationResponse(
    PublicTripSnapshotResponse snapshot,
    String snapshotFingerprint,
    String consentVersion,
    List<String> warnings) {}
