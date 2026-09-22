package fu.tripsense.socialservice.dto.request;

import jakarta.validation.constraints.NotBlank;

public record RefreshTripSharePublicationRequest(
    @NotBlank String expectedSnapshotFingerprint, @NotBlank String consentVersion) {}
