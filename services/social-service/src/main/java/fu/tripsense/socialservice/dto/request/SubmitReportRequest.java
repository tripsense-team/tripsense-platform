package fu.tripsense.socialservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SubmitReportRequest(@NotBlank String reason, @Size(max = 500) String details) {}
