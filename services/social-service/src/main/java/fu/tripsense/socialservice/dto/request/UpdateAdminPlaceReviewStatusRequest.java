package fu.tripsense.socialservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateAdminPlaceReviewStatusRequest(
    @NotBlank String status, @Size(max = 500) String reason, Long version) {}

