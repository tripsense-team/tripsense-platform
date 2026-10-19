package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.application.CandidateRetrievalPipeline.RetrievalOutcome;
import fu.tripsense.recommendation.application.port.CandidateFusionStrategy;
import fu.tripsense.recommendation.application.port.CandidateGenerationResult;
import fu.tripsense.recommendation.application.port.Diversifier;
import fu.tripsense.recommendation.application.port.ImpressionRecorder;
import fu.tripsense.recommendation.application.port.Ranker;
import fu.tripsense.recommendation.application.port.RecommendationContextProvider;
import fu.tripsense.recommendation.config.AlgorithmVersionCatalog;
import fu.tripsense.recommendation.domain.CandidateFeatures;
import fu.tripsense.recommendation.domain.CandidateSource;
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
    PreparedRecommendation prepared = prepare(command);
    record(prepared);
    return prepared.result();
  }

  public PreparedRecommendation prepare(RecommendationCommand command) {
    return prepare(contextProvider.resolve(command));
  }

  public RecommendationContext resolveContext(RecommendationCommand command) {
    return contextProvider.resolve(command);
  }

  public PreparedRecommendation prepare(RecommendationContext context) {
    long started = System.nanoTime();
    RetrievalOutcome retrieval =
        RequestDiagnostics.measure("retrieval", () -> retrievalPipeline.retrieve(context));
    long retrievalDone = System.nanoTime();
    return prepare(context, retrieval, started, retrievalDone);
  }

  public PreparedRecommendation supplementWithProvider(PreparedRecommendation previous) {
    RetrievalOutcome original = previous.retrieval();
    if (original == null)
      throw new IllegalArgumentException("Retrieval evidence required for supplementation");
    long started = System.nanoTime();
    RetrievalOutcome refreshed = retrievalPipeline.retrievePlace(previous.context());
    var sources = new ArrayList<CandidateGenerationResult>();
    boolean replaced = false;
    for (var source : original.sources()) {
      if (source.source() == CandidateSource.PLACE_RETRIEVAL) {
        sources.addAll(refreshed.sources());
        replaced = true;
      } else sources.add(source);
    }
    if (!replaced) sources.addAll(0, refreshed.sources());
    var degradations = new ArrayList<>(original.degradations());
    degradations.addAll(refreshed.degradations());
    return prepare(
        previous.context(),
        new RetrievalOutcome(sources, degradations.stream().distinct().toList()),
        started,
        System.nanoTime());
  }

  private PreparedRecommendation prepare(
      RecommendationContext context, RetrievalOutcome retrieval, long started, long retrievalDone) {
    List<FusedCandidate> fused =
        RequestDiagnostics.measure("fusion", () -> fusion.fuse(retrieval.sources()));
    CandidateFilterPipeline.FilterOutcome filterOutcome =
        RequestDiagnostics.measure("filter", () -> filters.filterWithEvidence(context, fused));
    List<FusedCandidate> eligible = filterOutcome.eligible();
    long filterDone = System.nanoTime();
    List<FusedCandidate> enriched =
        RequestDiagnostics.measure("enrichment", () -> enrichment.enrich(context, eligible));
    List<CandidateFeatures> extracted =
        RequestDiagnostics.measure("features", () -> features.extract(context, enriched));
    long featureDone = System.nanoTime();
    List<RankedCandidate> ranked =
        RequestDiagnostics.measure("ranking", () -> ranker.rank(context, extracted));
    long rankingDone = System.nanoTime();
    List<RankedCandidate> diversified =
        RequestDiagnostics.measure(
            "diversity", () -> diversifier.diversify(context, ranked, context.limit()));
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
    long completed = System.nanoTime();
    observability.record(fused.size(), completed - started, result.degradations());
    log.info(
        "recommendation_prepared recommendationId={} requestId={} generated={} fused={} eligible={} output={} retrievalMs={} filterMs={} featureMs={} rankingMs={} diversityMs={} preparationMs={} versions={}",
        result.recommendationId(),
        context.requestId(),
        retrieval.sources().stream().mapToInt(value -> value.candidates().size()).sum(),
        fused.size(),
        eligible.size(),
        diversified.size(),
        millis(started, retrievalDone),
        millis(retrievalDone, filterDone),
        millis(filterDone, featureDone),
        millis(featureDone, rankingDone),
        millis(rankingDone, diversityDone),
        millis(started, completed),
        result.versions());
    return new PreparedRecommendation(context, result, retrieval);
  }

  public void record(PreparedRecommendation prepared) {
    impressionRecorder.record(prepared.context(), prepared.result());
  }

  /** Shared fusion/filter/features; only ranking/diversification loops over bounded categories. */
  public List<FusedCandidate> eligibleSectionSeed(
      RecommendationContext context,
      List<fu.tripsense.recommendation.domain.Candidate> candidates) {
    var sources =
        candidates.stream()
            .collect(
                java.util.stream.Collectors.groupingBy(
                    fu.tripsense.recommendation.domain.Candidate::source))
            .entrySet()
            .stream()
            .map(e -> new CandidateGenerationResult(e.getKey(), e.getValue(), List.of()))
            .toList();
    return filters.filter(context, fusion.fuse(sources)).stream()
        .filter(c -> !context.profile().negativePlaceIds().contains(c.placeId()))
        .toList();
  }

  public PreparedRecommendation prepareSections(
      RecommendationContext context,
      RetrievalOutcome retrieval,
      List<fu.tripsense.recommendation.domain.DiscoveryCategory> categories,
      int perSection,
      java.util.Map<fu.tripsense.recommendation.domain.DiscoveryCategory, List<String>> prefix) {
    var fused = RequestDiagnostics.measure("fusion", () -> fusion.fuse(retrieval.sources()));
    var outcome =
        RequestDiagnostics.measure("filter", () -> filters.filterWithEvidence(context, fused));
    var eligible =
        outcome.eligible().stream()
            .filter(c -> !context.profile().negativePlaceIds().contains(c.placeId()))
            .toList();
    var enriched =
        RequestDiagnostics.measure("enrichment", () -> enrichment.enrich(context, eligible));
    var extracted =
        RequestDiagnostics.measure("features", () -> features.extract(context, enriched));
    List<RankedCandidate> items = new ArrayList<>();
    for (var category : categories) {
      var subset =
          extracted.stream()
              .filter(
                  f ->
                      categories.size() == 1
                          ? category.matches(f.place())
                          : fu.tripsense.recommendation.domain.DiscoveryCategory.owner(f.place())
                              == category)
              .toList();
      RequestDiagnostics.mark(
          "eligible_" + category.name().toLowerCase(java.util.Locale.ROOT), subset.size());
      var ranked =
          RequestDiagnostics.measure(
              "ranking_" + category.name().toLowerCase(java.util.Locale.ROOT),
              () -> ranker.rank(context, subset));
      var diversified = diversifier.diversify(context, ranked, Math.max(perSection, ranked.size()));
      var ordered = new ArrayList<RankedCandidate>();
      for (String id : prefix.getOrDefault(category, List.of()))
        diversified.stream()
            .filter(c -> c.features().placeId().equals(id))
            .findFirst()
            .ifPresent(ordered::add);
      var used =
          ordered.stream()
              .map(c -> c.features().placeId())
              .collect(java.util.stream.Collectors.toSet());
      diversified.stream().filter(c -> used.add(c.features().placeId())).forEach(ordered::add);
      items.addAll(ordered.stream().limit(perSection).toList());
    }
    var result =
        new RecommendationResult(
            UUID.randomUUID(),
            context.requestId(),
            items,
            versions.current(),
            retrieval.degradations(),
            categories.size() * perSection,
            context.rankingCriteria().stream().map(criterion -> criterion.feature()).toList(),
            fused.size(),
            outcome.rejectedByReason());
    return new PreparedRecommendation(context, result, retrieval);
  }

  private long millis(long from, long to) {
    return (to - from) / 1_000_000;
  }

  public record PreparedRecommendation(
      RecommendationContext context, RecommendationResult result, RetrievalOutcome retrieval) {
    public PreparedRecommendation(RecommendationContext context, RecommendationResult result) {
      this(context, result, null);
    }
  }
}
