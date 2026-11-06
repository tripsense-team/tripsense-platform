package fu.tripsense.socialservice.dto.response;

import java.util.List;

public record SavedPostPageResponse(List<SavedPostItemResponse> items, String nextCursor) {}
