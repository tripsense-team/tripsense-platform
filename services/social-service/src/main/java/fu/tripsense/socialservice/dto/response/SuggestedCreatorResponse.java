package fu.tripsense.socialservice.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.UUID;

public record SuggestedCreatorResponse(
    UUID id,
    String name,
    String avatar,
    String niche,
    String nicheKey,
    long followerCount,
    @JsonProperty("isFollowing") boolean isFollowing,
    Integer tripCount) {}
