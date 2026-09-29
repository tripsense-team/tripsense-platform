package fu.tripsense.socialservice.dto.request;

import jakarta.validation.constraints.*;
import java.util.UUID;

public record CreateCommentRequest(
    @NotBlank @Size(max = 2000) String content,
    UUID parentId,
    Integer submittedUnderRevision
) {
  public CreateCommentRequest(String content, UUID parentId) {
    this(content, parentId, null);
  }
}
