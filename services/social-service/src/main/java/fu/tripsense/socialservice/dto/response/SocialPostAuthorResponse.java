package fu.tripsense.socialservice.dto.response;
import java.util.UUID;
public record SocialPostAuthorResponse(UUID id, String name, String avatar, String email) { }
