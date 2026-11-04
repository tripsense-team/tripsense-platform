package fu.tripsense.socialservice.dto.response;

import java.time.Instant;

public record SavedPostItemResponse(SocialPostResponse post, Instant savedAt) {}
