package fu.tripsense.tripservice.partner.dto;

import java.util.UUID;
import lombok.Builder;

@Builder
public record PromotionMediaUploadIntentDto(
    UUID mediaId,
    String objectKey,
    String uploadUrl,
    long expiresInSeconds
) {}
