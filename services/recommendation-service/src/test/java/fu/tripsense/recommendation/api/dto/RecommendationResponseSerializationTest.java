package fu.tripsense.recommendation.api.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import fu.tripsense.recommendation.domain.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RecommendationResponseSerializationTest {

  @Test
  void testSerialization() throws Exception {
    ObjectMapper mapper = new ObjectMapper();
    mapper.registerModule(new JavaTimeModule());

    PlaceSnapshot place =
        new PlaceSnapshot(
            "p1",
            "GOOGLE",
            "p1",
            "Test Place",
            new GeoPoint(10.0, 106.0),
            "Address",
            "HCMC",
            "D1",
            List.of("CAFE"),
            4.5,
            100,
            new QuietnessEvidence(0.8, 5, "REVIEWS", Instant.now()),
            List.of("http://example.com/photo.jpg"),
            "08:00 - 22:00",
            "OPERATIONAL",
            "Description",
            Instant.now(),
            "FRESH");

    CandidateFeatures features =
        new CandidateFeatures(
            "p1",
            place,
            List.of(),
            new CandidateFeatures.Retrieval(0.9, 2, 0.8),
            new CandidateFeatures.Semantic(true, 0.85, 0.5),
            new CandidateFeatures.Preference(true, 0.5, true, false),
            new CandidateFeatures.Geographic(true, 1.5, 0.9),
            new CandidateFeatures.Quality(true, true, 4.5, 100, 4.0, 0.8),
            new CandidateFeatures.Quietness(true, 0.8, 5, "REVIEWS"),
            new CandidateFeatures.Contextual(true, 0.9, 0.8),
            new CandidateFeatures.History(true, false, false, false, false));

    RankedCandidate candidate =
        new RankedCandidate(
            features,
            0.95,
            new ScoreBreakdown(1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.95, 0.8),
            List.of(
                new RecommendationReason(RecommendationReasonCode.STRONG_RETRIEVAL_MATCH, 0.8, "2"),
                new RecommendationReason(
                    RecommendationReasonCode.STRONG_SEMANTIC_MATCH, 0.7, "0.8500")));

    RecommendationResult result =
        new RecommendationResult(
            UUID.randomUUID(),
            UUID.randomUUID(),
            List.of(candidate),
            new AlgorithmVersions("v1", "v1", "v1", "v1", "v1", "v1"),
            List.of(),
            10,
            List.of(RankingCriterion.Feature.DISTANCE, RankingCriterion.Feature.RATING),
            1,
            Map.of());

    RecommendationResponse response = RecommendationResponse.from(result);
    ApiResponse<RecommendationResponse> apiResponse = ApiResponse.success(response);

    String json = mapper.writeValueAsString(apiResponse);
    assertThat(json).isNotNull();
    assertThat(json).contains("Test Place");
  }
}
