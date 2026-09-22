package fu.tripsense.placeservice.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record RetrievalEvidenceDto(
        String status,
        boolean queryResolved,
        int candidateCount,
        int eligibleCount,
        Map<String, Double> requiredFieldCoverage,
        double geographicCoverage,
        String freshness,
        Set<String> sourceSet,
        Instant retrievedAt,
        String providerStatus,
        boolean refreshPerformed,
        List<String> reasonCodes,
        String rankingVersion
) {
}
