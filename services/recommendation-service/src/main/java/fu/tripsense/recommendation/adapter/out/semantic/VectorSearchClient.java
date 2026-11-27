package fu.tripsense.recommendation.adapter.out.semantic;

import java.util.List;
import java.util.Optional;
import java.time.Instant;

public interface VectorSearchClient {
  List<SemanticCandidate> search(List<Double> vector, int limit);

  Optional<String> storedContentHash(String placeId);

  default Optional<StoredVectorMetadata> storedMetadata(String placeId) {
    return storedContentHash(placeId)
        .map(hash -> new StoredVectorMetadata(hash, null, null, null));
  }

  void upsert(String placeId, List<Double> vector, String modelVersion, String contentHash);

  default void upsert(
      String placeId,
      List<Double> vector,
      String modelVersion,
      String contentHash,
      Long sourceVersion,
      Instant sourceUpdatedAt) {
    upsert(placeId, vector, modelVersion, contentHash);
  }

  void delete(String placeId);

  record StoredVectorMetadata(
      String contentHash,
      Long sourceVersion,
      Instant sourceUpdatedAt,
      String embeddingVersion) {}
}
