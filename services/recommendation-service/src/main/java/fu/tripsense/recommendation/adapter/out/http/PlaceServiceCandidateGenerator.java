package fu.tripsense.recommendation.adapter.out.http;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import fu.tripsense.recommendation.application.port.CandidateGenerationResult;
import fu.tripsense.recommendation.application.port.CandidateGenerator;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.Candidate;
import fu.tripsense.recommendation.domain.CandidateSource;
import fu.tripsense.recommendation.domain.GeoPoint;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import fu.tripsense.recommendation.domain.RecommendationContext;
import fu.tripsense.recommendation.domain.QuietnessEvidence;
import fu.tripsense.recommendation.domain.RetrievalEvidence;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class PlaceServiceCandidateGenerator implements CandidateGenerator {
  private final RestClient restClient;
  private final String baseUrl;
  private final int sourceLimit;
  private final int candidateMultiplier;
  private final long maximumPlaceAgeSeconds;

  public PlaceServiceCandidateGenerator(
      RestClient recommendationRestClient, RecommendationProperties properties) {
    this.restClient = recommendationRestClient;
    this.baseUrl = properties.getDownstream().getPlaceUrl();
    this.sourceLimit = properties.getRetrieval().getSourceLimit();
    this.candidateMultiplier = properties.getRetrieval().getCandidateMultiplier();
    this.maximumPlaceAgeSeconds = properties.getRetrieval().getMaximumPlaceAge().toSeconds();
  }

  @Override
  public CandidateSource source() {
    return CandidateSource.PLACE_RETRIEVAL;
  }

  @Override
  public boolean optional() {
    return false;
  }

  @Override
  public CandidateGenerationResult generate(RecommendationContext context) {
    PlaceRequest request =
        new PlaceRequest(
            retrievalQuery(context),
            context.anchor() == null ? null : context.anchor().lat(),
            context.anchor() == null ? null : context.anchor().lng(),
            context.radiusMeters(),
            Math.min(sourceLimit, Math.max(context.limit() * candidateMultiplier, context.limit())),
            List.of("id", "location", "categories"),
            maximumPlaceAgeSeconds,
            true);
    try {
      Envelope envelope =
          restClient
              .post()
              .uri(baseUrl + "/api/places/recommendations")
              .body(request)
              .retrieve()
              .body(Envelope.class);
      if (envelope == null || !envelope.success() || envelope.data() == null) {
        throw new IllegalStateException("Place response has no data");
      }
      RetrievalEvidence evidence = mapEvidence(envelope.data().evidence());
      List<Candidate> candidates =
          java.util.stream.IntStream.range(0, envelope.data().candidates().size())
              .mapToObj(
                  index -> {
                    PlaceDto place = envelope.data().candidates().get(index);
                    return new Candidate(
                        place.id(), source(), index + 1, null, place.toDomain(), evidence);
                  })
              .toList();
      List<String> degradations =
          evidence == null || "SUFFICIENT".equals(evidence.status())
              ? List.of()
              : List.of("PLACE_RETRIEVAL_" + evidence.status());
      return new CandidateGenerationResult(source(), candidates, degradations);
    } catch (RuntimeException exception) {
      throw new DownstreamServiceException("place-service", exception);
    }
  }

  private String retrievalQuery(RecommendationContext context) {
    if (!context.requiredCategories().isEmpty()) {
      return context.requiredCategories().stream().sorted().findFirst().orElse(context.query());
    }
    return context.query();
  }

  private RetrievalEvidence mapEvidence(EvidenceDto value) {
    if (value == null) return null;
    return new RetrievalEvidence(
        value.status(),
        value.queryResolved(),
        value.candidateCount(),
        value.eligibleCount(),
        value.requiredFieldCoverage(),
        value.geographicCoverage(),
        value.freshness(),
        value.sourceSet(),
        value.retrievedAt(),
        value.providerStatus(),
        value.refreshPerformed(),
        value.reasonCodes(),
        value.rankingVersion());
  }

  record PlaceRequest(
      String query,
      Double lat,
      Double lng,
      Integer radiusMeters,
      int targetCount,
      List<String> requiredFields,
      long maximumAgeSeconds,
      boolean allowExternalRefresh) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record Envelope(boolean success, ResultDto data) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record ResultDto(List<PlaceDto> candidates, EvidenceDto evidence) {
    ResultDto {
      candidates = candidates == null ? List.of() : candidates;
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  record PlaceDto(
      String id,
      String provider,
      String providerPlaceId,
      String name,
      LocationDto location,
      String address,
      String city,
      String district,
      List<String> categories,
      Double rating,
      Integer userRatingCount,
      QuietnessEvidenceDto quietnessEvidence,
      List<String> photos,
      String openingHours,
      String businessStatus,
      String description,
      Instant fetchedAt,
      String freshness) {
    PlaceSnapshot toDomain() {
      return new PlaceSnapshot(
          id,
          provider,
          providerPlaceId,
          name,
          location == null ? null : new GeoPoint(location.lat(), location.lng()),
          address,
          city,
          district,
          categories,
          rating,
          userRatingCount,
          quietnessEvidence == null
              ? null
              : new QuietnessEvidence(
                  quietnessEvidence.score(),
                  quietnessEvidence.evidenceCount(),
                  quietnessEvidence.source(),
                  quietnessEvidence.observedAt()),
          photos,
          openingHours,
          businessStatus,
          description,
          fetchedAt,
          freshness);
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  record LocationDto(double lat, double lng) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record QuietnessEvidenceDto(
      Double score, Integer evidenceCount, String source, Instant observedAt) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record EvidenceDto(
      String status,
      boolean queryResolved,
      int candidateCount,
      int eligibleCount,
      Map<String, Double> requiredFieldCoverage,
      double geographicCoverage,
      String freshness,
      Set<String> sourceSet,
      Instant retrievedAt,
      String providerStatus,
      boolean refreshPerformed,
      List<String> reasonCodes,
      String rankingVersion) {}
}
