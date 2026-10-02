package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.GuideInquiryEntryKind;
import java.time.Instant;
import java.util.UUID;

public record GuideInquiryEntryDto(
    UUID id,
    int seq,
    UUID actorId,
    String roleSnapshot,
    GuideInquiryEntryKind kind,
    String body,
    Object payload,
    Instant createdAt
) {}
