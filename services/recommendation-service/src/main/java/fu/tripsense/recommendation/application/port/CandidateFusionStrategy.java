package fu.tripsense.recommendation.application.port;

import fu.tripsense.recommendation.domain.FusedCandidate;
import java.util.List;

public interface CandidateFusionStrategy {
  List<FusedCandidate> fuse(List<CandidateGenerationResult> sources);
}
