package fu.tripsense.placeservice.dto;

import java.util.List;

public record PlaceRecommendationResult(
        List<PlaceDto> candidates,
        RetrievalEvidenceDto evidence
) {
}
