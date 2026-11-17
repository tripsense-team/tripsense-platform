package fu.tripsense.recommendation.application;

import java.util.List;

public record AdminRecommendationStatsResult(
    int periodDays,
    long totalImpressions,
    long periodImpressions,
    long totalRecommendedItems,
    FunnelStats funnel,
    List<PositionBucketStats> positionBuckets,
    PersonalizationComparison personalizationComparison) {

  public record FunnelStats(
      long impressions,
      long clicks,
      long detailViews,
      long saves,
      long addToTrip,
      double ctrPercent,
      double conversionRatePercent) {}

  public record PositionBucketStats(
      String bucket, long impressions, long clicks, double ctrPercent) {}

  public record PersonalizationComparison(
      long personalizedImpressions,
      double personalizedCtrPercent,
      long degradedImpressions,
      double degradedCtrPercent) {}
}

