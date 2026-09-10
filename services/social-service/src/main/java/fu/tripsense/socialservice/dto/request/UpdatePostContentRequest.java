package fu.tripsense.socialservice.dto.request;

import jakarta.validation.constraints.Size;

public record UpdatePostContentRequest(
        @Size(max = 5000, message = "Content must not exceed 5000 characters")
        String content
) {
}
