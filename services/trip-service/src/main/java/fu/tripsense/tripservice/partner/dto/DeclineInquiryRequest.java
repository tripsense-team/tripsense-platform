package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record DeclineInquiryRequest(
    @NotNull Long expectedVersion,
    @NotBlank @Size(max = 500) String reason
) {}
