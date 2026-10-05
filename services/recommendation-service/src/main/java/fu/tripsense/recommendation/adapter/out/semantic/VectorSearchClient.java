package fu.tripsense.recommendation.adapter.out.semantic;

import java.util.List;
import java.util.Optional;

public interface VectorSearchClient {
  List<SemanticCandidate> search(List<Double> vector, int limit);

  Optional<String> storedContentHash(String placeId);

  void upsert(String placeId, List<Double> vector, String modelVersion, String contentHash);
}
