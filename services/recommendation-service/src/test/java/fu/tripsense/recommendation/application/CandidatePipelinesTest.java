package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fu.tripsense.recommendation.algorithm.feature.GeoDistanceCalculator;
import fu.tripsense.recommendation.algorithm.filter.BusinessStatusFilter;
import fu.tripsense.recommendation.algorithm.filter.CanonicalPlaceFilter;
import fu.tripsense.recommendation.algorithm.filter.ExplicitExclusionFilter;
import fu.tripsense.recommendation.algorithm.filter.MaximumRadiusFilter;
import fu.tripsense.recommendation.algorithm.filter.RequiredCategoryFilter;
import fu.tripsense.recommendation.algorithm.filter.StrictNamedAreaFilter;
import fu.tripsense.recommendation.application.port.CandidateGenerationResult;
import fu.tripsense.recommendation.application.port.CandidateGenerator;
import fu.tripsense.recommendation.domain.Candidate;
import fu.tripsense.recommendation.domain.CandidateSource;
import fu.tripsense.recommendation.domain.FusedCandidate;
import fu.tripsense.recommendation.domain.GeoPoint;
import fu.tripsense.recommendation.domain.GeographicScope;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CandidatePipelinesTest {
  @Test
  void optionalGeneratorFailureDegradesWithoutFailingRequest() {
    CandidateRetrievalPipeline pipeline =
        new CandidateRetrievalPipeline(
            List.of(
                generator(CandidateSource.PLACE_RETRIEVAL, false, false),
                generator(CandidateSource.SEMANTIC, true, true)));

    var outcome = pipeline.retrieve(context(null, Set.of()));

    assertThat(outcome.sources()).hasSize(1);
    assertThat(outcome.degradations()).containsExactly("SEMANTIC_UNAVAILABLE");
  }

  @Test
  void requiredGeneratorFailureFailsOnlyWhenNoFallbackCandidatesExist() {
    CandidateRetrievalPipeline pipeline =
        new CandidateRetrievalPipeline(
            List.of(generator(CandidateSource.PLACE_RETRIEVAL, false, true)));
    assertThatThrownBy(() -> pipeline.retrieve(context(null, Set.of())))
        .isInstanceOf(CandidateRetrievalUnavailableException.class);
  }

  @Test
  void hardFiltersRejectClosedExcludedOutOfRadiusAndIncompleteCandidates() {
    CandidateFilterPipeline pipeline =
        new CandidateFilterPipeline(
            List.of(
                new CanonicalPlaceFilter(),
                new BusinessStatusFilter(),
                new ExplicitExclusionFilter(),
                new MaximumRadiusFilter(new GeoDistanceCalculator())));
    RecommendationContext context = context(1_000, Set.of("bar"));

    List<FusedCandidate> candidates =
        List.of(
            fused(place("ok", List.of("museum"), "OPERATIONAL", new GeoPoint(10, 106))),
            fused(place("closed", List.of("museum"), "CLOSED", new GeoPoint(10, 106))),
            fused(place("excluded", List.of("BAR"), "OPERATIONAL", new GeoPoint(10, 106))),
            fused(place("far", List.of("museum"), "OPERATIONAL", new GeoPoint(11, 106))),
            new FusedCandidate("missing", null, 1, List.of()));

    assertThat(pipeline.filter(context, candidates))
        .extracting(FusedCandidate::placeId)
        .containsExactly("ok");
  }

  @Test
  void requiredCategoryAndStrictAreaAreFilteredBeforeRankingWithTypedReasons() {
    CandidateFilterPipeline pipeline = new CandidateFilterPipeline(
        List.of(new RequiredCategoryFilter(), new StrictNamedAreaFilter()));
    RecommendationContext context = new RecommendationContext(
        UUID.randomUUID(), UUID.randomUUID(), null, "session", "cafe", new GeoPoint(16.1068, 108.2772),
        5_000, Set.of(), Set.of(), Set.of("CAFE"),
        new GeographicScope("Sơn Trà, Đà Nẵng", "Đà Nẵng", "Sơn Trà", true), List.of(),
        null, null, 5);
    PlaceSnapshot matchingCafe = new PlaceSnapshot("cafe", "fixture", "cafe", "cafe", new GeoPoint(16.1068, 108.2772),
        "Hoàng Sa, Sơn Trà, Đà Nẵng", "Đà Nẵng", "Sơn Trà", List.of("quán cà phê"), 4.5, 20,
        List.of(), null, "OPERATIONAL", null, null, "FRESH");
    PlaceSnapshot restaurantInArea = new PlaceSnapshot("food", "fixture", "food", "food", new GeoPoint(16.1068, 108.2772),
        "Hoàng Sa, Sơn Trà, Đà Nẵng", "Đà Nẵng", "Sơn Trà", List.of("restaurant"), 4.5, 20,
        List.of(), null, "OPERATIONAL", null, null, "FRESH");
    var cafe = fused(matchingCafe);
    var restaurant = fused(restaurantInArea);
    PlaceSnapshot wrongDistrict = new PlaceSnapshot("wrong", "fixture", "wrong", "wrong", new GeoPoint(16.1068, 108.2772),
        "Hải Châu, Đà Nẵng", "Đà Nẵng", "Hải Châu", List.of("cafe"), 4.9, 50,
        List.of(), null, "OPERATIONAL", null, null, "FRESH");
    PlaceSnapshot conflictingAddress = new PlaceSnapshot("wrong-address", "ziomap", "wrong-address", "wrong address", new GeoPoint(16.1068, 108.2772),
        "Gần chùa Linh Ứng, Hải Châu, Đà Nẵng", "Đà Nẵng", null, List.of("cafe"), 4.0, 10,
        List.of(), null, "OPERATIONAL", null, null, "FRESH");

    var outcome = pipeline.filterWithEvidence(
        context, List.of(cafe, restaurant, fused(wrongDistrict), fused(conflictingAddress)));

    assertThat(outcome.eligible()).extracting(FusedCandidate::placeId).containsExactly("cafe");
    assertThat(outcome.rejectedByReason()).containsEntry("CATEGORY_MISMATCH", 1)
        .containsEntry("ADMIN_LOCATION_CONFLICT", 2);
  }

  @Test
  void hotelCategoryAliasesMatchLodgingButRejectAttractions() {
    CandidateFilterPipeline pipeline =
        new CandidateFilterPipeline(List.of(new RequiredCategoryFilter()));
    RecommendationContext hotelContext = new RecommendationContext(
        UUID.randomUUID(), UUID.randomUUID(), null, "session", "khách sạn", null,
        null, Set.of(), Set.of(), Set.of("HOTEL"), null, List.of(), null, null, 5);
    PlaceSnapshot hotel = place("hotel", List.of("Khách sạn", "lodging"), "OPERATIONAL", null);
    PlaceSnapshot pagoda = place(
        "linh-ung", List.of("tourist attraction", "pagoda"), "OPERATIONAL", null);

    var outcome = pipeline.filterWithEvidence(
        hotelContext, List.of(fused(hotel), fused(pagoda)));

    assertThat(outcome.eligible()).extracting(FusedCandidate::placeId).containsExactly("hotel");
    assertThat(outcome.rejectedByReason()).containsEntry("CATEGORY_MISMATCH", 1);
  }

  private CandidateGenerator generator(CandidateSource source, boolean optional, boolean fail) {
    return new CandidateGenerator() {
      public CandidateSource source() {
        return source;
      }

      public boolean optional() {
        return optional;
      }

      public CandidateGenerationResult generate(RecommendationContext context) {
        if (fail) throw new IllegalStateException("unavailable");
        return new CandidateGenerationResult(
            source,
            List.of(
                new Candidate(
                    "ok", source, 1, 1.0, place("ok", List.of(), "OPERATIONAL", null), null)),
            List.of());
      }
    };
  }

  private RecommendationContext context(Integer radius, Set<String> dislikes) {
    return new RecommendationContext(
        UUID.randomUUID(),
        UUID.randomUUID(),
        null,
        "session",
        "museum",
        new GeoPoint(10, 106),
        radius,
        Set.of(),
        dislikes,
        null,
        null,
        10);
  }

  private FusedCandidate fused(PlaceSnapshot place) {
    return new FusedCandidate(place.id(), place, 1, List.of());
  }

  private PlaceSnapshot place(
      String id, List<String> categories, String status, GeoPoint location) {
    return new PlaceSnapshot(
        id,
        "GOOGLE",
        id,
        id,
        location,
        "address",
        "HCMC",
        "D1",
        categories,
        4.5,
        20,
        List.of(),
        null,
        status,
        null,
        null,
        "FRESH");
  }
}
