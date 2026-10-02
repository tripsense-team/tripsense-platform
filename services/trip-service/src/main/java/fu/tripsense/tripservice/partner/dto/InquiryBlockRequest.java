package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.Size;

public record InquiryBlockRequest(
    @Size(max = 500) String reason
) {}
