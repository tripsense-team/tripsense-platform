package fu.tripsense.recommendation.domain;

public record Candidate(
    String placeId,
    CandidateSource source,
    int sourceRank,
    Double sourceScore,
    PlaceSnapshot place,
    RetrievalEvidence retrievalEvidence) {
  public Candidate {
    if (placeId == null || placeId.isBlank())
      throw new IllegalArgumentException("placeId required");
    if (source == null) throw new IllegalArgumentException("candidate source required");
    if (sourceRank < 1) throw new IllegalArgumentException("source rank must be positive");
  }
}
