package fu.tripsense.socialservice.dto.request;

import jakarta.validation.constraints.*;

public record PlaceReviewRequest(
    @NotNull @Min(1) @Max(5) Integer rating,
    @NotBlank @Size(min = 10, max = 2000) String content,
    Long version) {}
