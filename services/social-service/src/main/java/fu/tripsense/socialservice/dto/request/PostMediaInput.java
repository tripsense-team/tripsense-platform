package fu.tripsense.socialservice.dto.request;
import jakarta.validation.constraints.*;
public record PostMediaInput(@NotBlank String publicId, @NotBlank @Size(max=2048) String secureUrl, @NotBlank String resourceType, @NotBlank @Size(max=32) String format, @NotNull @Positive Integer width, @NotNull @Positive Integer height, @NotNull @Min(0) @Max(Short.MAX_VALUE) Integer sortOrder) { }
