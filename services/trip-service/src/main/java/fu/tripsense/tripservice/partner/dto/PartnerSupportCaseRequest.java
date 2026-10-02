package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record PartnerSupportCaseRequest(
    @NotBlank
    @Pattern(regexp = "HOTEL_BOOKING|GUIDE_INQUIRY|GUIDE_PROMOTION|MANAGEMENT_CLAIM")
    String resourceType,
    @NotNull UUID resourceId,
    @NotBlank @Size(max = 80) String category,
    @NotBlank @Size(max = 2000) String reason
) {}
