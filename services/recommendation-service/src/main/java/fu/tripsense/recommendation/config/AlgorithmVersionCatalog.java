package fu.tripsense.recommendation.config;

import fu.tripsense.recommendation.domain.AlgorithmVersions;
import org.springframework.stereotype.Component;

@Component
public class AlgorithmVersionCatalog {
  private final RecommendationProperties properties;

  public AlgorithmVersionCatalog(RecommendationProperties properties) {
    this.properties = properties;
  }

  public AlgorithmVersions current() {
    RecommendationProperties.Versions versions = properties.getVersions();
    return new AlgorithmVersions(
        versions.getRetrieval(),
        versions.getFusion(),
        properties.getSemantic().isEnabled()
            ? properties.getSemantic().getEmbeddingModel()
            : versions.getEmbedding(),
        versions.getFeature(),
        versions.getRanking(),
        properties.getDiversity().isEnabled() ? versions.getDiversity() : "none");
  }
}
