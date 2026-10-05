package fu.tripsense.recommendation.domain;

public record CandidateSourceEvidence(
    CandidateSource source, int rank, Double sourceScore, RetrievalEvidence retrievalEvidence) {}
