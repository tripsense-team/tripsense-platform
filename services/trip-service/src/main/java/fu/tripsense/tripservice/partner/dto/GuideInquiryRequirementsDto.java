package fu.tripsense.tripservice.partner.dto;

import java.time.Instant;
import java.util.UUID;

public record GuideInquiryRequirementsDto(
    int revision,
    Object data,
    UUID createdBy,
    Instant createdAt
) {}
