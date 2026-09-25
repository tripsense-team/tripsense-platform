package fu.tripsense.recommendation.domain;

import java.util.List;

public record FusedCandidate(
    String placeId,
    PlaceSnapshot place,
    double fusionScore,
    List<CandidateSourceEvidence> sources) {
  public FusedCandidate {
    sources = sources == null ? List.of() : List.copyOf(sources);
  }
}
