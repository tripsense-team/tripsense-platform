package fu.tripsense.recommendation.adapter.out.semantic;

import fu.tripsense.recommendation.domain.PlaceSnapshot;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    prefix = "tripsense.recommendation.semantic",
    name = "enabled",
    havingValue = "true")
public class PlaceSemanticIndexer {
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
    PlaceSemanticDocument document = documents.build(place);
    if (vectors.storedContentHash(place.id()).filter(document.contentHash()::equals).isPresent()) {
      return false;
    }
    vectors.upsert(
        place.id(),
        embeddings.embed(document.content()),
        embeddings.modelVersion(),
        document.contentHash());
    return true;
  }
}
