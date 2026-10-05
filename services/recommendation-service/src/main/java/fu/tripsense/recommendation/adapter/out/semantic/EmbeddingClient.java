package fu.tripsense.recommendation.adapter.out.semantic;

import java.util.List;

public interface EmbeddingClient {
  List<Double> embed(String content);

  String modelVersion();
}
