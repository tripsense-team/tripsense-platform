package fu.tripsense.recommendation.adapter.out.semantic;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fu.tripsense.recommendation.domain.GeoPoint;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PlaceSemanticIndexerTest {

  private PlaceSemanticDocumentBuilder documentBuilder;
  private EmbeddingClient embeddingClient;
  private VectorSearchClient vectorSearchClient;
  private PlaceSemanticIndexer indexer;

  @BeforeEach
  void setUp() {
    documentBuilder = new PlaceSemanticDocumentBuilder();
    embeddingClient = mock(EmbeddingClient.class);
    vectorSearchClient = mock(VectorSearchClient.class);
    indexer = new PlaceSemanticIndexer(documentBuilder, embeddingClient, vectorSearchClient);
  }

  @Test
  @DisplayName("Should embed and upsert vector when place is new (no stored hash)")
  void shouldEmbedAndUpsertWhenNew() {
    PlaceSnapshot place = samplePlace("p1", "Highlands Coffee");
    when(vectorSearchClient.storedContentHash("p1")).thenReturn(Optional.empty());
    when(embeddingClient.embed(any())).thenReturn(List.of(0.1, 0.2, 0.3));
    when(embeddingClient.modelVersion()).thenReturn("gemini-embedding-001");

    boolean indexed = indexer.indexIfChanged(place);

    assertThat(indexed).isTrue();
    verify(embeddingClient).embed(any());
    verify(vectorSearchClient).upsert(eq("p1"), eq(List.of(0.1, 0.2, 0.3)), eq("gemini-embedding-001"), any());
  }

  @Test
  @DisplayName("Should skip embedding and upsert when content hash has not changed")
  void shouldSkipWhenContentHashUnchanged() {
    PlaceSnapshot place = samplePlace("p1", "Highlands Coffee");
    PlaceSemanticDocument doc = documentBuilder.build(place);

    when(vectorSearchClient.storedContentHash("p1")).thenReturn(Optional.of(doc.contentHash()));

    boolean indexed = indexer.indexIfChanged(place);

    assertThat(indexed).isFalse();
    verify(embeddingClient, never()).embed(any());
    verify(vectorSearchClient, never()).upsert(any(), any(), any(), any());
  }

  @Test
  @DisplayName("Should re-index when content hash has changed")
  void shouldReindexWhenContentHashChanged() {
    PlaceSnapshot place = samplePlace("p1", "Highlands Coffee");

    when(vectorSearchClient.storedContentHash("p1")).thenReturn(Optional.of("old-hash-123"));
    when(embeddingClient.embed(any())).thenReturn(List.of(0.4, 0.5));
    when(embeddingClient.modelVersion()).thenReturn("gemini-embedding-001");

    boolean indexed = indexer.indexIfChanged(place);

    assertThat(indexed).isTrue();
    verify(embeddingClient).embed(any());
    verify(vectorSearchClient).upsert(eq("p1"), eq(List.of(0.4, 0.5)), eq("gemini-embedding-001"), any());
  }

  private PlaceSnapshot samplePlace(String id, String name) {
    return new PlaceSnapshot(
        id,
        "STORED",
        id,
        name,
        new GeoPoint(16.0544, 108.2022),
        "123 Nguyen Van Linh",
        "Da Nang",
        "Hai Chau",
        List.of("cafe"),
        4.5,
        100,
        List.of(),
        "08:00 - 22:00",
        "OPERATIONAL",
        "Quán cà phê ngon",
        Instant.now(),
        "LIVE");
  }
}
