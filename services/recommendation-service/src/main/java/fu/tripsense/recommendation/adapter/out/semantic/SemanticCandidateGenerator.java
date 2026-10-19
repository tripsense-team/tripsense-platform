package fu.tripsense.recommendation.adapter.out.semantic;

import fu.tripsense.recommendation.application.RequestDiagnostics;
import fu.tripsense.recommendation.application.port.CandidateGenerationResult;
import fu.tripsense.recommendation.application.port.CandidateGenerator;
import fu.tripsense.recommendation.application.port.PlaceSnapshotResolver;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.Candidate;
import fu.tripsense.recommendation.domain.CandidateSource;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    prefix = "tripsense.recommendation.semantic",
    name = "enabled",
    havingValue = "true")
public class SemanticCandidateGenerator implements CandidateGenerator {
  private final EmbeddingClient embeddings;
  private final VectorSearchClient vectors;
  private final QueryEmbeddingCache cache;
  private final PlaceSnapshotResolver places;
  private final int sourceLimit;
  private final int candidateMultiplier;

  public SemanticCandidateGenerator(
      EmbeddingClient embeddings,
      VectorSearchClient vectors,
      QueryEmbeddingCache cache,
      PlaceSnapshotResolver places,
      RecommendationProperties properties) {
    this.embeddings = embeddings;
    this.vectors = vectors;
    this.cache = cache;
    this.places = places;
    this.sourceLimit = properties.getRetrieval().getSourceLimit();
    this.candidateMultiplier = properties.getRetrieval().getCandidateMultiplier();
  }

  @Override
  public CandidateSource source() {
    return CandidateSource.SEMANTIC;
  }

  @Override
  public boolean optional() {
    return true;
  }

  @Override
  public CandidateGenerationResult generate(RecommendationContext context) {
    return generateBounded(context, sourceLimit);
  }

  public CandidateGenerationResult generateBounded(
      RecommendationContext context, int maximumCandidates) {
    var cached =
        RequestDiagnostics.measure(
            "embedding_cache_get", () -> cache.get(embeddings.modelVersion(), context.query()));
    RequestDiagnostics.mark("embedding_cache_hit", cached.isPresent());
    List<Double> embedding =
        cached.orElseGet(
            () -> {
              List<Double> value =
                  RequestDiagnostics.measure(
                      "embedding_api", () -> embeddings.embed(context.query()));
              RequestDiagnostics.run(
                  "embedding_cache_put",
                  () -> cache.put(embeddings.modelVersion(), context.query(), value));
              return value;
            });
    List<SemanticCandidate> found =
        RequestDiagnostics.measure(
            "qdrant_search",
            () ->
                vectors.search(
                    embedding,
                    Math.min(
                        Math.min(sourceLimit, maximumCandidates),
                        Math.max(context.limit() * candidateMultiplier, context.limit()))));
    RequestDiagnostics.mark("semantic_vector_candidates", found.size());
    List<String> placeIds = found.stream().map(SemanticCandidate::placeId).toList();
    RequestDiagnostics.mark("snapshot_batch_requested", placeIds.size());
    Map<String, PlaceSnapshot> resolved =
        RequestDiagnostics.measure(
            "snapshot_batch",
            () ->
                context.allowExternalRefresh()
                    ? places.resolveBatch(placeIds)
                    : places.resolveLocalBatch(placeIds));
    // Count requested candidates, not map entries: aliases may map to the same snapshot.
    long batchResolved =
        placeIds.stream().filter(id -> resolved != null && resolved.get(id) != null).count();
    RequestDiagnostics.mark("snapshot_batch_resolved", batchResolved);
    RequestDiagnostics.mark("snapshot_missing_after_batch", placeIds.size() - batchResolved);
    List<Candidate> candidates = new ArrayList<>();
    List<String> degradations = new ArrayList<>();
    int individualCalls = 0;
    try {
      for (int index = 0; index < found.size(); index++) {
        SemanticCandidate semantic = found.get(index);
        int rank = index + 1;
        PlaceSnapshot place = resolved != null ? resolved.get(semantic.placeId()) : null;
        if (place == null && context.allowExternalRefresh()) {
          individualCalls++;
          place = places.find(semantic.placeId()).orElse(null);
        }
        if (place != null) {
          candidates.add(
              new Candidate(
                  semantic.placeId(), source(), rank, semantic.similarity(), place, null));
        } else {
          degradations.add("SEMANTIC_PLACE_UNRESOLVED");
        }
      }
    } finally {
      RequestDiagnostics.mark("snapshot_generator_fallback_calls", individualCalls);
      RequestDiagnostics.mark("semantic_candidates_returned", candidates.size());
    }
    return new CandidateGenerationResult(
        source(), candidates, degradations.stream().distinct().toList());
  }
}
