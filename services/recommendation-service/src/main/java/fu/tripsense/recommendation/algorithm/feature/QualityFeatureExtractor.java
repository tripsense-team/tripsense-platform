package fu.tripsense.recommendation.algorithm.feature;

import fu.tripsense.recommendation.application.port.FeatureExtractor;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import org.springframework.stereotype.Component;

@Component
public class QualityFeatureExtractor implements FeatureExtractor {
  private final BayesianQualityCalculator bayesian;
  private final PopularityNormalizer popularity;
  private final double priorRating;
  private final double confidenceThreshold;

  public QualityFeatureExtractor(
      BayesianQualityCalculator bayesian,
      PopularityNormalizer popularity,
      RecommendationProperties properties) {
    this.bayesian = bayesian;
    this.popularity = popularity;
    this.priorRating = properties.getFeatures().getPriorRating();
    this.confidenceThreshold = properties.getFeatures().getRatingConfidenceThreshold();
  }

  @Override
  public int order() {
    return 50;
  }

  @Override
  public CandidateFeatures extract(
      RecommendationContext context, FusedCandidate candidate, CandidateFeatures current) {
    Double rating = candidate.place().rating();
    Integer count = candidate.place().userRatingCount();
    boolean popularityAvailable = count != null && count >= 0;
    int safeCount = popularityAvailable ? count : 0;
    boolean ratingAvailable = rating != null && rating >= 0 && rating <= 5 && safeCount > 0;
    if (!ratingAvailable && !popularityAvailable) return current;
    double weighted = ratingAvailable ? bayesian.weightedRating(rating, safeCount, priorRating, confidenceThreshold) : 0;
    double popular = popularity.unitScale(popularity.logPopularity(safeCount));
    return current.withQuality(
        new CandidateFeatures.Quality(ratingAvailable, popularityAvailable,
            ratingAvailable ? rating : null, popularityAvailable ? safeCount : null,
            ratingAvailable ? weighted / 5.0 : 0, popularityAvailable ? popular : 0));
  }
}
