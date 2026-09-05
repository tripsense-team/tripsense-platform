package fu.tripsense.socialservice.dto.request;
import jakarta.validation.Valid; import jakarta.validation.constraints.Size; import java.util.List;
public record CreatePostRequest(@Size(max=5000, message="Content must not exceed 5000 characters") String content, List<@Valid PostMediaInput> media) { }
