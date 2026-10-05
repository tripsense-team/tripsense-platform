package fu.tripsense.placeservice.dto;

import java.time.Instant;

public record QuietnessEvidenceDto(
    Double score, Integer evidenceCount, String source, Instant observedAt) {}
