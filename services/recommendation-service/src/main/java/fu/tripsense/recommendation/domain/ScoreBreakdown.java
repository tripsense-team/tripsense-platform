package fu.tripsense.recommendation.domain;

public record ScoreBreakdown(
    double retrieval,
    double semantic,
    double preference,
    double geographic,
    double quality,
    double quietness,
    double context,
    double popularity,
    double history,
    double finalScore,
    double evidenceCoverage,
    double budgetAdjustment,
    PriceEvidence budgetPriceEvidence) {
  public ScoreBreakdown(double retrieval, double semantic, double preference, double geographic,
      double quality, double quietness, double context, double popularity, double history,
      double finalScore, double evidenceCoverage) {
    this(retrieval, semantic, preference, geographic, quality, quietness, context, popularity,
        history, finalScore, evidenceCoverage, 0, null);
  }
  public ScoreBreakdown(
      double retrieval,
      double semantic,
      double preference,
      double geographic,
      double quality,
      double context,
      double popularity,
      double history,
      double finalScore) {
    this(
        retrieval,
        semantic,
        preference,
        geographic,
        quality,
        0,
        context,
        popularity,
        history,
        finalScore,
        1);
  }
}
