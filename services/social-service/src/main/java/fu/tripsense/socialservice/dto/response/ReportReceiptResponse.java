package fu.tripsense.socialservice.dto.response;

import java.time.Instant;
import java.util.UUID;

public record ReportReceiptResponse(UUID id, String status, Instant createdAt) {}
