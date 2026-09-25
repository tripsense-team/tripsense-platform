package fu.tripsense.recommendation.domain;

import java.time.Instant;

public record QuietnessEvidence(
    Double score, Integer evidenceCount, String source, Instant observedAt) {
  public boolean valid() {
    return score != null
        && score >= 0
        && score <= 1
        && evidenceCount != null
        && evidenceCount >= 0;
  }
}
