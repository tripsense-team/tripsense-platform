package fu.tripsense.recommendation.adapter.out.semantic;

import fu.tripsense.recommendation.application.port.CandidateGenerationResult;
import fu.tripsense.recommendation.application.port.CandidateGenerator;
import fu.tripsense.recommendation.application.port.PlaceSnapshotResolver;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.Candidate;
import fu.tripsense.recommendation.domain.CandidateSource;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.ArrayList;
import java.util.List;
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
    List<Double> embedding =
        cache
            .get(embeddings.modelVersion(), context.query())
            .orElseGet(
                () -> {
                  List<Double> value = embeddings.embed(context.query());
                  cache.put(embeddings.modelVersion(), context.query(), value);
                  return value;
                });
    List<SemanticCandidate> found =
        vectors.search(
            embedding,
            Math.min(
                sourceLimit, Math.max(context.limit() * candidateMultiplier, context.limit())));
    List<Candidate> candidates = new ArrayList<>();
    List<String> degradations = new ArrayList<>();
    for (int index = 0; index < found.size(); index++) {
      SemanticCandidate semantic = found.get(index);
      int rank = index + 1;
      places
          .find(semantic.placeId())
          .ifPresentOrElse(
              place ->
                  candidates.add(
                      new Candidate(
                          semantic.placeId(), source(), rank, semantic.similarity(), place, null)),
              () -> degradations.add("SEMANTIC_PLACE_UNRESOLVED"));
    }
    return new CandidateGenerationResult(
        source(), candidates, degradations.stream().distinct().toList());
  }
}
