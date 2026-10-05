package fu.tripsense.recommendation.algorithm.feature;

import org.springframework.stereotype.Component;

@Component
public class PopularityNormalizer {
  public double logPopularity(Integer reviewCount) {
    return Math.log1p(Math.max(0, reviewCount == null ? 0 : reviewCount));
  }

  public double unitScale(double logPopularity) {
    return logPopularity <= 0 ? 0 : logPopularity / (1.0 + logPopularity);
  }
}
