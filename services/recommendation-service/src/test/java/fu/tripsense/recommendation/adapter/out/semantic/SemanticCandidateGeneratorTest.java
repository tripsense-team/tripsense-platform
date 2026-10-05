package fu.tripsense.recommendation.adapter.out.semantic;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fu.tripsense.recommendation.application.port.PlaceSnapshotResolver;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SemanticCandidateGeneratorTest {
  private final EmbeddingClient embeddings = mock(EmbeddingClient.class);
  private final VectorSearchClient vectors = mock(VectorSearchClient.class);
  private final QueryEmbeddingCache cache = mock(QueryEmbeddingCache.class);
  private final PlaceSnapshotResolver places = mock(PlaceSnapshotResolver.class);

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
