package fu.tripsense.socialservice.dto.response;

import java.util.List;

public record ModerationReportPageResponse(
    List<ModerationReportResponse> items, long total, int page, int size, boolean hasMore) {}
