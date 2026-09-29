package fu.tripsense.tripservice.partner.dto;

import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record DocumentUploadIntentResponse(
    UUID documentId,
    String uploadUrl,
    String objectKey,
    Instant expiresAt
) {}
