package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SupportCaseResolutionRequest(
    @NotBlank
    @Pattern(
        regexp =
            "HOTEL_SERVICE_FAILURE_CANCEL|GUIDE_INQUIRY_CLOSE|PROMOTION_HIDE|CLAIM_INVITATION_MEDIATION|CLAIM_REJECT|CLAIM_ALLOW_DISTINCT|CLAIM_SUSPEND_BUSINESS|NOTE_AND_RESOLVE")
    String action,
    @Size(max = 2000) String resolutionNote
) {}
