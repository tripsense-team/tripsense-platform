package fu.tripsense.socialservice.dto.request;

import jakarta.validation.constraints.NotBlank;

public record UpdatePostVisibilityRequest(
        @NotBlank(message = "visibility is required")
        String visibility
) {
}
