package fu.tripsense.socialservice.dto.response;
import java.util.List;
public record SocialPostPageResponse(List<SocialPostResponse> items, long total, int page, int size, boolean hasMore) { }
