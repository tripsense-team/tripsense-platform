package fu.tripsense.recommendation.api.dto;

import fu.tripsense.recommendation.domain.AlgorithmVersions;
import fu.tripsense.recommendation.domain.GeoPoint;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import fu.tripsense.recommendation.domain.RecommendationReasonCode;
import fu.tripsense.recommendation.domain.RecommendationResult;
import fu.tripsense.recommendation.domain.ScoreBreakdown;
import java.util.List;
import java.util.UUID;
import java.util.Map;
import fu.tripsense.recommendation.domain.QuietnessEvidence;
import fu.tripsense.recommendation.domain.RecommendationReason;
import fu.tripsense.recommendation.domain.RankingCriterion;
import java.util.stream.IntStream;

public record RecommendationResponse(
    UUID recommendationId,
    int requestedCount,
    int returnedCount,
    boolean complete,
    String rankingStatus,
    List<RankingCriterion.Feature> rankingBasis,
    List<RankingCriterion.Feature> unavailableCriteria,
    Warning warning,
    List<Item> items,
    AlgorithmVersions versions,
    List<String> degradations,
    FilterSummary filterSummary) {
  public static RecommendationResponse from(RecommendationResult result) {
    List<RankingCriterion.Feature> requested = result.requestedCriteria();
    List<Item> items =
        IntStream.range(0, result.items().size())
            .mapToObj(
                index -> {
                  var candidate = result.items().get(index);
                  return new Item(
                      Place.from(candidate.features().place()),
                      index + 1,
                      candidate.score(),
                      candidate.breakdown().evidenceCoverage(),
                      candidate.breakdown(),
                      Distance.from(candidate.features()),
                      availableCriteria(candidate.features()).stream()
                          .filter(requested::contains)
                          .toList(),
                      requested.stream()
                          .filter(feature -> !availableCriteria(candidate.features()).contains(feature))
                          .toList(),
                      candidate.reasons().stream().map(Reason::from).toList());
                })
            .toList();
    List<RankingCriterion.Feature> basis = requested.stream()
        .filter(feature -> items.stream().anyMatch(item -> item.availableCriteria().contains(feature)))
        .toList();
    List<RankingCriterion.Feature> unavailable = requested.stream()
        .filter(feature -> items.stream().noneMatch(item -> item.availableCriteria().contains(feature)))
        .toList();
    boolean complete = items.size() >= result.requestedCount();
    String rankingStatus = basis.isEmpty() ? "UNRANKED" : "RANKED";
    Warning warning = complete
        ? null
        : items.isEmpty()
            ? new Warning("NO_ELIGIBLE_CANDIDATES", "recommendation.noEligibleCandidates")
            : new Warning("INSUFFICIENT_VERIFIED_CANDIDATES", "recommendation.insufficientVerifiedCandidates");
    return new RecommendationResponse(
        result.recommendationId(), result.requestedCount(), items.size(), complete, rankingStatus, basis, unavailable,
        warning,
        items, result.versions(), result.degradations(),
        new FilterSummary(
            result.retrievedCount(),
            Math.max(
                0,
                result.retrievedCount()
                    - result.rejectedByReason().values().stream().mapToInt(Integer::intValue).sum()),
            result.rejectedByReason()));
  }

  public record Item(
      Place place,
      int rank,
      double score,
      double evidenceCoverage,
      ScoreBreakdown scoreBreakdown,
      Distance distance,
      List<RankingCriterion.Feature> availableCriteria,
      List<RankingCriterion.Feature> unavailableCriteria,
      List<Reason> reasons) {}

  public record Warning(String code, String messageKey) {}
  public record FilterSummary(int retrieved, int eligible, Map<String, Integer> rejectedByReason) {}
  public record Distance(Double straightLineKm, Double routeDistanceKm, String kind) {
    static Distance from(fu.tripsense.recommendation.domain.CandidateFeatures features) {
      return features.geographic().available()
          ? new Distance(features.geographic().distanceKm(), null, "STRAIGHT_LINE") : null;
    }
  }
  public record Reason(RecommendationReasonCode code, String criterion, Object supportingValue, double contribution) {
    static Reason from(RecommendationReason reason) {
      return new Reason(reason.code(), criterion(reason.code()), reason.supportingValue(), reason.contribution());
    }
    private static String criterion(RecommendationReasonCode code) {
      return switch (code) {
        case NEAR_TRIP_AREA -> "DISTANCE";
        case HIGH_CONFIDENCE_RATING -> "RATING";
        case VERIFIED_QUIETNESS -> "QUIETNESS";
        case POPULAR_CHOICE -> "POPULARITY";
        case STRONG_RETRIEVAL_MATCH -> "RETRIEVAL_RELEVANCE";
        case STRONG_SEMANTIC_MATCH -> "SEMANTIC";
        case MATCHES_USER_PREFERENCE -> "PREFERENCE";
        case MATCHES_TRIP_CONTEXT -> "CONTEXT";
        case PREVIOUSLY_SAVED -> "HISTORY";
      };
    }
  }

  public record Place(
      String id,
      String provider,
      String providerPlaceId,
      String name,
      GeoPoint location,
      String address,
      String city,
      String district,
      List<String> categories,
      Double rating,
      Integer userRatingCount,
      QuietnessEvidence quietnessEvidence,
      List<String> photos,
      String openingHours,
      String businessStatus,
      String description,
      String freshness) {
    static Place from(PlaceSnapshot value) {
      return new Place(
          value.id(),
          value.provider(),
          value.providerPlaceId(),
          value.name(),
          value.location(),
          value.address(),
          value.city(),
          value.district(),
          value.categories(),
          value.rating(),
          value.userRatingCount(),
          value.quietnessEvidence(),
          value.photos(),
          value.openingHours(),
          value.businessStatus(),
          value.description(),
          value.freshness());
    }
  }

  private static List<RankingCriterion.Feature> availableCriteria(
      fu.tripsense.recommendation.domain.CandidateFeatures features) {
    var values = new java.util.ArrayList<RankingCriterion.Feature>();
    values.add(RankingCriterion.Feature.RETRIEVAL_RELEVANCE);
    if (features.geographic().available()) values.add(RankingCriterion.Feature.DISTANCE);
    if (features.quality().ratingAvailable()) values.add(RankingCriterion.Feature.RATING);
    if (features.quality().popularityAvailable()) values.add(RankingCriterion.Feature.POPULARITY);
    if (features.quietness().available()) values.add(RankingCriterion.Feature.QUIETNESS);
    if (features.preference().available()) values.add(RankingCriterion.Feature.PREFERENCE);
    if (features.contextual().available()) values.add(RankingCriterion.Feature.CONTEXT);
    if (features.history().available()) values.add(RankingCriterion.Feature.HISTORY);
    if (features.semantic().available()) values.add(RankingCriterion.Feature.SEMANTIC);
    return List.copyOf(values);
  }

}
