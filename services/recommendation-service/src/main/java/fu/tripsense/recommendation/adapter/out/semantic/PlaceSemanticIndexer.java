package fu.tripsense.recommendation.adapter.out.semantic;

import fu.tripsense.recommendation.application.port.PlaceIndexer;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import java.time.Instant;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    prefix = "tripsense.recommendation.semantic",
    name = "enabled",
    havingValue = "true")
public class PlaceSemanticIndexer implements PlaceIndexer {
  private final PlaceSemanticDocumentBuilder documents;
  private final EmbeddingClient embeddings;
  private final VectorSearchClient vectors;

  public PlaceSemanticIndexer(
      PlaceSemanticDocumentBuilder documents,
      EmbeddingClient embeddings,
      VectorSearchClient vectors) {
    this.documents = documents;
    this.embeddings = embeddings;
    this.vectors = vectors;
  }

  public boolean indexIfChanged(PlaceSnapshot place) {
    return indexIfChanged(place, null, null);
  }

  @Override
  public boolean indexIfChanged(
      PlaceSnapshot place, Long sourceVersion, Instant sourceUpdatedAt) {
    PlaceSemanticDocument document = documents.build(place);
    String modelVersion = embeddings.modelVersion();
    var stored = vectors.storedMetadata(place.id());
    if (stored.isPresent()
        && sourceVersion != null
        && stored.get().sourceVersion() != null
        && sourceVersion < stored.get().sourceVersion()) {
      return false;
    }
    if (stored.filter(value -> document.contentHash().equals(value.contentHash()))
        .filter(value -> value.embeddingVersion() == null || modelVersion.equals(value.embeddingVersion()))
        .isPresent()) {
      return false;
    }
    vectors.upsert(
        place.id(),
        embeddings.embed(document.content()),
        modelVersion,
        document.contentHash(),
        sourceVersion,
        sourceUpdatedAt);
    return true;
  }

  @Override
  public void remove(String placeId) {
    vectors.delete(placeId);
  }
}
