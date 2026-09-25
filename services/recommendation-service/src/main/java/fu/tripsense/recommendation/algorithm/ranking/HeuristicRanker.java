package fu.tripsense.recommendation.algorithm.ranking;

import fu.tripsense.recommendation.application.port.Ranker;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.RankedCandidate;
import fu.tripsense.recommendation.domain.RankingCriterion;
import fu.tripsense.recommendation.domain.RecommendationContext;
import fu.tripsense.recommendation.domain.RecommendationReason;
import fu.tripsense.recommendation.domain.RecommendationReasonCode;
import fu.tripsense.recommendation.domain.ScoreBreakdown;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class HeuristicRanker implements Ranker {
  private final RecommendationProperties.Ranking weights;
  private final double rrfNormalizationPivot;

  public HeuristicRanker(RecommendationProperties properties) {
    this.weights = properties.getRanking();
    this.rrfNormalizationPivot = weights.getRrfNormalizationPivot();
  }

  @Override
  public List<RankedCandidate> rank(RecommendationContext context, List<CandidateFeatures> candidates) {
    return candidates.stream()
        .map(features -> score(context, features))
        .sorted(Comparator.comparingDouble(RankedCandidate::score).reversed()
            .thenComparing((RankedCandidate value) -> value.breakdown().evidenceCoverage(), Comparator.reverseOrder())
            .thenComparingInt(this::upstreamRank)
            .thenComparing(value -> value.features().placeId()))
        .toList();
  }

  RankedCandidate score(CandidateFeatures features) {
    return score(defaultContext(), features);
  }

  private RankedCandidate score(RecommendationContext context, CandidateFeatures features) {
    Map<RankingCriterion.Feature, Double> active = activeWeights(context);
    Map<RankingCriterion.Feature, Double> values = values(features);
    double totalActiveWeight = active.values().stream().mapToDouble(Double::doubleValue).sum();
    double availableWeight = active.entrySet().stream()
        .filter(entry -> available(entry.getKey(), features))
        .mapToDouble(Map.Entry::getValue).sum();
    double denominator = availableWeight > 0 ? availableWeight : 1;

    double retrieval = contribution(active, values, RankingCriterion.Feature.RETRIEVAL_RELEVANCE, features, denominator);
    double semantic = contribution(active, values, RankingCriterion.Feature.SEMANTIC, features, denominator);
    double preference = contribution(active, values, RankingCriterion.Feature.PREFERENCE, features, denominator);
    double geographic = contribution(active, values, RankingCriterion.Feature.DISTANCE, features, denominator);
    double quality = contribution(active, values, RankingCriterion.Feature.RATING, features, denominator);
    double quietness = contribution(active, values, RankingCriterion.Feature.QUIETNESS, features, denominator);
    double contextual = contribution(active, values, RankingCriterion.Feature.CONTEXT, features, denominator);
    double popularity = contribution(active, values, RankingCriterion.Feature.POPULARITY, features, denominator);
    double history = contribution(active, values, RankingCriterion.Feature.HISTORY, features, denominator);

    double penalties = 0;
    if (features.preference().available() && features.preference().dislikeConflict()) penalties -= weights.getDislikeConflictPenalty();
    if (features.history().available() && features.history().previousNegativeFeedback()) penalties -= weights.getNegativeFeedbackPenalty();
    double finalScore = Math.max(0, Math.min(1, retrieval + semantic + preference + geographic + quality + quietness + contextual + popularity + history + penalties));
    double evidenceCoverage = totalActiveWeight == 0 ? 0 : availableWeight / totalActiveWeight;
    ScoreBreakdown breakdown = new ScoreBreakdown(retrieval, semantic, preference, geographic, quality,
        quietness, contextual, popularity, history, finalScore, evidenceCoverage);
    return new RankedCandidate(features, finalScore, breakdown, reasons(features, breakdown));
  }

  private Map<RankingCriterion.Feature, Double> activeWeights(RecommendationContext context) {
    Map<RankingCriterion.Feature, Double> active = new EnumMap<>(RankingCriterion.Feature.class);
    if (!context.rankingCriteria().isEmpty()) {
      for (RankingCriterion criterion : context.rankingCriteria()) {
        active.put(criterion.feature(), baseWeight(criterion.feature()) * importance(criterion.importance()));
      }
      return active;
    }
    for (RankingCriterion.Feature feature : RankingCriterion.Feature.values()) active.put(feature, baseWeight(feature));
    return active;
  }

  private double baseWeight(RankingCriterion.Feature feature) {
    return switch (feature) {
      case RETRIEVAL_RELEVANCE -> weights.getRetrievalWeight();
      case SEMANTIC -> weights.getSemanticWeight();
      case PREFERENCE -> weights.getPreferenceWeight();
      case DISTANCE -> weights.getGeographicWeight();
      case RATING -> weights.getQualityWeight();
      case QUIETNESS -> weights.getQuietnessWeight();
      case CONTEXT -> weights.getContextWeight();
      case POPULARITY -> weights.getPopularityWeight();
      case HISTORY -> weights.getHistoryWeight();
    };
  }

  private double importance(RankingCriterion.Importance importance) {
    return switch (importance) { case LOW -> 0.5; case MEDIUM -> 1; case HIGH -> 1.5; };
  }

  private Map<RankingCriterion.Feature, Double> values(CandidateFeatures f) {
    Map<RankingCriterion.Feature, Double> values = new EnumMap<>(RankingCriterion.Feature.class);
    values.put(RankingCriterion.Feature.RETRIEVAL_RELEVANCE, normalizeRrf(f.retrieval().rrfScore()));
    values.put(RankingCriterion.Feature.SEMANTIC, Math.max(f.semantic().querySimilarity(), f.semantic().userSimilarity()));
    values.put(RankingCriterion.Feature.PREFERENCE, f.preference().categoryMatch());
    values.put(RankingCriterion.Feature.DISTANCE, f.geographic().distanceScore());
    values.put(RankingCriterion.Feature.RATING, f.quality().bayesianRating());
    values.put(RankingCriterion.Feature.QUIETNESS, f.quietness().score() == null ? 0 : f.quietness().score());
    values.put(RankingCriterion.Feature.CONTEXT, f.contextual().tripDestinationMatch());
    values.put(RankingCriterion.Feature.POPULARITY, f.quality().popularity());
    values.put(RankingCriterion.Feature.HISTORY, f.history().previouslySaved() ? 1.0 : 0.0);
    return values;
  }

  private boolean available(RankingCriterion.Feature feature, CandidateFeatures f) {
    return switch (feature) {
      case RETRIEVAL_RELEVANCE -> true;
      case SEMANTIC -> f.semantic().available();
      case PREFERENCE -> f.preference().available();
      case DISTANCE -> f.geographic().available();
      case RATING -> f.quality().ratingAvailable();
      case QUIETNESS -> f.quietness().available();
      case CONTEXT -> f.contextual().available();
      case POPULARITY -> f.quality().popularityAvailable();
      case HISTORY -> f.history().available();
    };
  }

  private double contribution(Map<RankingCriterion.Feature, Double> active,
      Map<RankingCriterion.Feature, Double> values, RankingCriterion.Feature feature,
      CandidateFeatures candidate, double denominator) {
    if (!active.containsKey(feature) || !available(feature, candidate)) return 0;
    return active.get(feature) * values.getOrDefault(feature, 0.0) / denominator;
  }

  private double normalizeRrf(double value) { return value <= 0 ? 0 : value / (value + rrfNormalizationPivot); }
  private int upstreamRank(RankedCandidate value) { return value.features().sourceEvidence().stream().mapToInt(e -> e.rank()).min().orElse(Integer.MAX_VALUE); }

  private List<RecommendationReason> reasons(CandidateFeatures f, ScoreBreakdown b) {
    List<RecommendationReason> values = new ArrayList<>();
    if (b.retrieval() > 0) values.add(new RecommendationReason(RecommendationReasonCode.STRONG_RETRIEVAL_MATCH, b.retrieval(), Integer.toString(f.retrieval().sourceCount())));
    if (b.semantic() > 0) values.add(new RecommendationReason(RecommendationReasonCode.STRONG_SEMANTIC_MATCH, b.semantic(), format(f.semantic().querySimilarity())));
    if (b.preference() > 0) values.add(new RecommendationReason(RecommendationReasonCode.MATCHES_USER_PREFERENCE, b.preference(), format(f.preference().categoryMatch())));
    if (b.geographic() > 0) values.add(new RecommendationReason(RecommendationReasonCode.NEAR_TRIP_AREA, b.geographic(), format(f.geographic().distanceKm())));
    if (b.quality() > 0) values.add(new RecommendationReason(RecommendationReasonCode.HIGH_CONFIDENCE_RATING, b.quality(), format(f.quality().rawRating())));
    if (b.quietness() > 0) values.add(new RecommendationReason(RecommendationReasonCode.VERIFIED_QUIETNESS, b.quietness(), format(f.quietness().score())));
    if (b.context() > 0) values.add(new RecommendationReason(RecommendationReasonCode.MATCHES_TRIP_CONTEXT, b.context(), "trip"));
    if (b.popularity() > 0) values.add(new RecommendationReason(RecommendationReasonCode.POPULAR_CHOICE, b.popularity(), String.valueOf(f.quality().reviewCount())));
    if (f.history().available() && f.history().previouslySaved()) values.add(new RecommendationReason(RecommendationReasonCode.PREVIOUSLY_SAVED, 0, "saved"));
    return values.stream().sorted(Comparator.comparingDouble(RecommendationReason::contribution).reversed()).limit(4).toList();
  }

  private String format(Double value) { return value == null ? "unknown" : String.format(Locale.ROOT, "%.4f", value); }
  private RecommendationContext defaultContext() { return new RecommendationContext(java.util.UUID.randomUUID(), java.util.UUID.randomUUID(), null, null, "", null, null, java.util.Set.of(), java.util.Set.of(), null, null, 10); }
}
