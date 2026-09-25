package fu.tripsense.recommendation.algorithm.feature;

import fu.tripsense.recommendation.application.port.FeatureExtractor;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.QuietnessEvidence;
import fu.tripsense.recommendation.domain.RecommendationContext;
import org.springframework.stereotype.Component;

@Component
public class QuietnessFeatureExtractor implements FeatureExtractor {
  @Override public int order() { return 55; }
  @Override public CandidateFeatures extract(RecommendationContext context, FusedCandidate candidate, CandidateFeatures current) {
    QuietnessEvidence evidence = candidate.place().quietnessEvidence();
    if (evidence == null || !evidence.valid()) return current;
    return current.withQuietness(new CandidateFeatures.Quietness(true, evidence.score(), evidence.evidenceCount(), evidence.source()));
  }
}
