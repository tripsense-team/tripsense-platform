package fu.tripsense.socialservice.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record InternalGuideSummaryResponse(
    UUID businessId,
    UUID promotionId,
    UUID approvedRevisionId,
    String availability, // AVAILABLE, UNAVAILABLE, TEMPORARILY_UNAVAILABLE
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
