package fu.tripsense.socialservice.dto.response;

import java.util.List;
import java.util.UUID;

public record GuidePromotionSummaryResponse(
    UUID businessId,
    UUID promotionId,
    UUID approvedRevisionId,
    String title,
    String summary,
    String coverImageUrl,
    List<String> areaTopics,
    List<String> skillLabels,
    List<String> languageLabels,
    Object indicativePrice,
    String profilePath,
    String promotionPath,
    boolean canRequestInquiry
) {}
