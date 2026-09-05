package fu.tripsense.socialservice.dto.request;
import jakarta.validation.constraints.NotBlank;
public record UploadSignatureRequest(@NotBlank String resourceType) { }
