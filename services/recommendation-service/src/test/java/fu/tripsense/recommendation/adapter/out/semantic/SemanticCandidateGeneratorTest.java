package fu.tripsense.recommendation.adapter.out.semantic;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fu.tripsense.recommendation.application.RequestDiagnostics;
import fu.tripsense.recommendation.application.port.PlaceSnapshotResolver;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import fu.tripsense.recommendation.domain.RecommendationContext;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SemanticCandidateGeneratorTest {
  private final EmbeddingClient embeddings = mock(EmbeddingClient.class);
  private final VectorSearchClient vectors = mock(VectorSearchClient.class);
  private final QueryEmbeddingCache cache = mock(QueryEmbeddingCache.class);
  private final PlaceSnapshotResolver places = mock(PlaceSnapshotResolver.class);
  private final SimpleMeterRegistry registry = new SimpleMeterRegistry();

  @BeforeEach
  void startDiagnostics() {
    RequestDiagnostics.begin("test", "semantic-test-123", registry);
  }

  @AfterEach
  void stopDiagnostics() {
    RequestDiagnostics.finish(200);
    registry.close();
  }

  @Test
  void usesCachedQueryEmbeddingAndHydratesCanonicalPlaces() {
    when(embeddings.modelVersion()).thenReturn("embedding-v1");
    when(cache.get("embedding-v1", "quiet cafe")).thenReturn(Optional.of(List.of(0.1, 0.2)));
    when(vectors.search(List.of(0.1, 0.2), 15))
        .thenReturn(List.of(new SemanticCandidate("place-1", 0.91)));
    when(places.find("place-1")).thenReturn(Optional.of(place("place-1")));

    var result = generator().generate(context());

    assertThat(result.candidates()).hasSize(1);
    assertThat(result.candidates().getFirst().sourceScore()).isEqualTo(0.91);
    verify(embeddings, never()).embed("quiet cafe");
    assertThat(registry.find("tripsense.explore.phase").tag("phase", "embedding_api").timer())
        .isNull();
    assertPhase("embedding_cache_get", "success");
    assertPhase("qdrant_search", "success");
    assertPhase("snapshot_batch", "success");
  }

  @Test
  void reportsUnresolvedSemanticReferencesWithoutInventingPlaceData() {
    when(embeddings.modelVersion()).thenReturn("embedding-v1");
    when(cache.get("embedding-v1", "quiet cafe")).thenReturn(Optional.empty());
    when(embeddings.embed("quiet cafe")).thenReturn(List.of(0.3));
    when(vectors.search(List.of(0.3), 15))
        .thenReturn(List.of(new SemanticCandidate("missing", 0.8)));
    when(places.find("missing")).thenReturn(Optional.empty());

    var result = generator().generate(context());

    assertThat(result.candidates()).isEmpty();
    assertThat(result.degradations()).containsExactly("SEMANTIC_PLACE_UNRESOLVED");
    verify(cache).put("embedding-v1", "quiet cafe", List.of(0.3));
    assertPhase("embedding_api", "success");
    assertPhase("embedding_cache_put", "success");
  }

  @Test
  void resolvedBatchAliasesDoNotTriggerIndividualCalls() {
    when(embeddings.modelVersion()).thenReturn("embedding-v1");
    when(cache.get("embedding-v1", "quiet cafe")).thenReturn(Optional.of(List.of(0.1)));
    when(vectors.search(List.of(0.1), 15))
        .thenReturn(List.of(new SemanticCandidate("provider-id", 0.9)));
    var snapshot = place("canonical-id");
    when(places.resolveBatch(List.of("provider-id")))
        .thenReturn(Map.of("canonical-id", snapshot, "provider-id", snapshot));
    assertThat(generator().generate(context()).candidates()).hasSize(1);
    verify(places, never()).find(anyString());
    assertPhase("snapshot_batch", "success");
  }

  @Test
  void recordsVectorSearchFailureWithoutChangingTheException() {
    when(embeddings.modelVersion()).thenReturn("embedding-v1");
    when(cache.get("embedding-v1", "quiet cafe")).thenReturn(Optional.of(List.of(0.1)));
    var failure = new IllegalStateException("private provider detail");
    when(vectors.search(List.of(0.1), 15)).thenThrow(failure);
    assertThatThrownBy(() -> generator().generate(context())).isSameAs(failure);
    assertPhase("qdrant_search", "error");
  }

  @Test
  void internalOnlyHydrationSkipsMissingReferencesWithoutIndividualFallback() {
    when(embeddings.modelVersion()).thenReturn("embedding-v1");
    when(cache.get("embedding-v1", "quiet cafe")).thenReturn(Optional.of(List.of(0.1)));
    when(vectors.search(List.of(0.1), 15))
        .thenReturn(
            List.of(new SemanticCandidate("found", 0.9), new SemanticCandidate("missing", 0.8)));
    when(places.resolveLocalBatch(List.of("found", "missing")))
        .thenReturn(Map.of("found", place("found")));
    var result =
        generator().generate(context().withExternalRefresh(false).withParallelRetrieval(true));
    assertThat(result.candidates()).hasSize(1);
    assertThat(result.degradations()).containsExactly("SEMANTIC_PLACE_UNRESOLVED");
    verify(places, never()).find(anyString());
    verify(places, never()).resolveBatch(org.mockito.ArgumentMatchers.anyList());
  }

  private void assertPhase(String name, String outcome) {
    assertThat(
            registry
                .get("tripsense.explore.phase")
                .tags("phase", name, "outcome", outcome)
                .timer()
                .count())
        .isEqualTo(1);
  }

  private SemanticCandidateGenerator generator() {
    RecommendationProperties properties = new RecommendationProperties();
    return new SemanticCandidateGenerator(embeddings, vectors, cache, places, properties);
  }

  private RecommendationContext context() {
    return new RecommendationContext(
        UUID.randomUUID(),
        UUID.randomUUID(),
        null,
        "session",
        "quiet cafe",
        null,
        null,
        Set.of(),
        Set.of(),
        null,
        null,
        5);
  }

  private PlaceSnapshot place(String id) {
    return new PlaceSnapshot(
        id,
        null,
        null,
        id,
        null,
        null,
        null,
        null,
        List.of("cafe"),
        null,
        null,
        List.of(),
        null,
        "OPERATIONAL",
        null,
        null,
        null);
  }
}
