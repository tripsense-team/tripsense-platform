package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.domain.PlaceSnapshot;
import java.time.Instant;

public record PlaceIndexSubmission(
    PlaceSnapshot place, Long sourceVersion, Instant sourceUpdatedAt) {}
