package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.application.port.CandidateGenerationResult;
import fu.tripsense.recommendation.application.port.CandidateGenerator;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class CandidateRetrievalPipeline {
  private final List<CandidateGenerator> generators;

  public CandidateRetrievalPipeline(List<CandidateGenerator> generators) {
    this.generators = List.copyOf(generators);
  }

  public RetrievalOutcome retrieve(RecommendationContext context) {
    List<CandidateGenerationResult> results = new ArrayList<>();
    List<String> degradations = new ArrayList<>();
    RuntimeException requiredFailure = null;
    for (CandidateGenerator generator : generators) {
      try {
        CandidateGenerationResult result = generator.generate(context);
        results.add(result);
        degradations.addAll(result.degradations());
      } catch (RuntimeException exception) {
        degradations.add(generator.source() + "_UNAVAILABLE");
        log.warn(
            "candidate_generator_unavailable source={} optional={} errorType={}",
            generator.source(),
            generator.optional(),
            exception.getClass().getSimpleName());
        if (!generator.optional()) requiredFailure = exception;
      }
    }
    boolean hasCandidates = results.stream().anyMatch(result -> !result.candidates().isEmpty());
    if (!hasCandidates && requiredFailure != null) {
      throw new CandidateRetrievalUnavailableException(requiredFailure);
    }
    return new RetrievalOutcome(results, degradations.stream().distinct().toList());
  }

  public record RetrievalOutcome(
      List<CandidateGenerationResult> sources, List<String> degradations) {}
}
