package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.BlockSide;
import java.time.Instant;
import java.util.UUID;

public record GuideInquiryBlockDto(
    UUID guideBusinessId,
    UUID customerId,
    BlockSide blockedBySide,
    UUID actorId,
    String reason,
    boolean isActive,
    Instant createdAt
) {}
