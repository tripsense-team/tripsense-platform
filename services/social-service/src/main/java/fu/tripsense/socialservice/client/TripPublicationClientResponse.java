package fu.tripsense.socialservice.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TripPublicationClientResponse(
    PublicTripSnapshotClientResponse snapshot,
    String snapshotFingerprint,
    String consentVersion,
    List<String> warnings) {}
