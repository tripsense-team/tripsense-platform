package fu.tripsense.recommendation.domain;

public record AlgorithmVersions(
    String retrieval,
    String fusion,
    String embedding,
    String feature,
    String ranking,
    String diversity) {}
