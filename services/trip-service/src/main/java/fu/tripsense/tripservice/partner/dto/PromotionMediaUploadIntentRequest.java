package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record PromotionMediaUploadIntentRequest(
    UUID promotionId,
    @NotBlank String fileName,
    @NotBlank String mimeType,
    @Min(1) @Max(10485760) long fileSize
) {}
