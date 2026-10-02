package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.DocumentScanState;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record DocumentDetailDto(
    UUID id,
    UUID businessId,
    UUID claimId,
    String fileName,
    String mimeType,
    Long fileSizeBytes,
    DocumentScanState scanState,
    Instant createdAt
) {}
