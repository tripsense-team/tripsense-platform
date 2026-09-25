package fu.tripsense.recommendation.domain;

public record RecommendationReason(
    RecommendationReasonCode code, double contribution, String supportingValue) {}
