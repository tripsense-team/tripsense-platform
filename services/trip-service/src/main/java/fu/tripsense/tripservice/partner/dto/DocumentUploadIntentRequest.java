package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record DocumentUploadIntentRequest(
    @NotBlank String fileName,
    @NotBlank String mimeType,
    @NotNull @Positive Long fileSizeBytes
) {}
