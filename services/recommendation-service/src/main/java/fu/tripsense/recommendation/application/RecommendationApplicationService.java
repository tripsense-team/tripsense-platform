package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.application.CandidateRetrievalPipeline.RetrievalOutcome;
import fu.tripsense.recommendation.application.port.CandidateFusionStrategy;
import fu.tripsense.recommendation.application.port.Diversifier;
import fu.tripsense.recommendation.application.port.ImpressionRecorder;
import fu.tripsense.recommendation.application.port.Ranker;
import fu.tripsense.recommendation.application.port.RecommendationContextProvider;
import fu.tripsense.recommendation.config.AlgorithmVersionCatalog;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.RankedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import fu.tripsense.recommendation.domain.RecommendationResult;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class RecommendationApplicationService {
  private final RecommendationContextProvider contextProvider;
  private final CandidateRetrievalPipeline retrievalPipeline;
  private final CandidateFusionStrategy fusion;
  private final CandidateFilterPipeline filters;
  private final FeaturePipeline features;
  private final CandidateEvidenceEnrichmentPipeline enrichment;
  private final Ranker ranker;
  private final Diversifier diversifier;
  private final ImpressionRecorder impressionRecorder;
  private final AlgorithmVersionCatalog versions;
  private final RecommendationObservability observability;

  public RecommendationApplicationService(
      RecommendationContextProvider contextProvider,
      CandidateRetrievalPipeline retrievalPipeline,
      CandidateFusionStrategy fusion,
      CandidateFilterPipeline filters,
      CandidateEvidenceEnrichmentPipeline enrichment,
      FeaturePipeline features,
      Ranker ranker,
      Diversifier diversifier,
      ImpressionRecorder impressionRecorder,
      AlgorithmVersionCatalog versions,
      RecommendationObservability observability) {
    this.contextProvider = contextProvider;
    this.retrievalPipeline = retrievalPipeline;
    this.fusion = fusion;
    this.filters = filters;
    this.enrichment = enrichment;
    this.features = features;
    this.ranker = ranker;
    this.diversifier = diversifier;
    this.impressionRecorder = impressionRecorder;
    this.versions = versions;
    this.observability = observability;
  }

  public RecommendationResult recommend(RecommendationCommand command) {
    long started = System.nanoTime();
    RecommendationContext context = contextProvider.resolve(command);
    long contextDone = System.nanoTime();
    RetrievalOutcome retrieval = retrievalPipeline.retrieve(context);
    long retrievalDone = System.nanoTime();
    List<FusedCandidate> fused = fusion.fuse(retrieval.sources());
    CandidateFilterPipeline.FilterOutcome filterOutcome = filters.filterWithEvidence(context, fused);
    List<FusedCandidate> eligible = filterOutcome.eligible();
    long filterDone = System.nanoTime();
    List<FusedCandidate> enriched = enrichment.enrich(context, eligible);
    List<CandidateFeatures> extracted = features.extract(context, enriched);
    long featureDone = System.nanoTime();
    List<RankedCandidate> ranked = ranker.rank(context, extracted);
    long rankingDone = System.nanoTime();
    List<RankedCandidate> diversified = diversifier.diversify(context, ranked, context.limit());
    long diversityDone = System.nanoTime();
    List<String> degradations = new ArrayList<>(retrieval.degradations());
    if (context.profile().personalizationEnabled() && !context.profile().available()) {
      degradations.add("COLD_START_PROFILE");
    }
    if (fused.isEmpty()) degradations.add("NO_CANDIDATES");
    if (!fused.isEmpty() && eligible.isEmpty()) degradations.add("ALL_CANDIDATES_FILTERED");
    RecommendationResult result =
        new RecommendationResult(
            UUID.randomUUID(),
            context.requestId(),
            diversified,
            versions.current(),
            degradations.stream().distinct().toList(),
            context.limit(),
            context.rankingCriteria().stream().map(value -> value.feature()).toList(),
            fused.size(),
            filterOutcome.rejectedByReason());
    impressionRecorder.record(context, result);
    long completed = System.nanoTime();
    observability.record(fused.size(), completed - started, result.degradations());
    log.info(
        "recommendation_completed recommendationId={} requestId={} userId={} tripId={} generated={} fused={} eligible={} output={} contextMs={} retrievalMs={} filterMs={} featureMs={} rankingMs={} diversityMs={} persistenceMs={} totalMs={} versions={}",
        result.recommendationId(),
        context.requestId(),
        context.userId(),
        context.tripId(),
        retrieval.sources().stream().mapToInt(value -> value.candidates().size()).sum(),
        fused.size(),
        eligible.size(),
        diversified.size(),
        millis(started, contextDone),
        millis(contextDone, retrievalDone),
        millis(retrievalDone, filterDone),
        millis(filterDone, featureDone),
        millis(featureDone, rankingDone),
        millis(rankingDone, diversityDone),
        millis(diversityDone, completed),
        millis(started, completed),
        result.versions());
    return result;
  }

  private long millis(long from, long to) {
    return (to - from) / 1_000_000;
  }
}
