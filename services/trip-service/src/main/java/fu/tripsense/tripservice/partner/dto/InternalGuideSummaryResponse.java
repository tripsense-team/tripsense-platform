package fu.tripsense.tripservice.partner.dto;

import java.util.List;
import java.util.UUID;

public record InternalGuideSummaryResponse(
    UUID businessId,
    UUID promotionId,
    UUID approvedRevisionId,
    String availability,
    Long distributionVersion,
    boolean communityEnabled,
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
