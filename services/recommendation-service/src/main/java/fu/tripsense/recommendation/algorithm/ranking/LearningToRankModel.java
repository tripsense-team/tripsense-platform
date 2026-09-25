package fu.tripsense.recommendation.algorithm.ranking;

import fu.tripsense.recommendation.domain.CandidateFeatures;

/**
 * Boundary for a real externally trained model artifact. No production implementation is bundled.
 */
public interface LearningToRankModel {
  String modelVersion();

  String requiredFeatureVersion();

  double predict(CandidateFeatures features);
}
