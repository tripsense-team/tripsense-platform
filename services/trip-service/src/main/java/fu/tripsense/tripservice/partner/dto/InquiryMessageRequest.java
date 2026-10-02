package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record InquiryMessageRequest(
    @NotNull Long expectedVersion,
    @NotBlank @Size(max = 2000) String body
) {}
