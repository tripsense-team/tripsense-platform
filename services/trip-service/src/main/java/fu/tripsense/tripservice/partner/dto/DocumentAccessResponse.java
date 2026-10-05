package fu.tripsense.tripservice.partner.dto;

import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record DocumentAccessResponse(
    UUID documentId,
    String accessUrl,
    String fileName,
    String mimeType,
    Instant expiresAt
) {}
