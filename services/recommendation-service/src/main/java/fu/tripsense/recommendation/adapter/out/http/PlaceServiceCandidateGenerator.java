package fu.tripsense.recommendation.adapter.out.http;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import fu.tripsense.recommendation.application.port.CandidateGenerationResult;
import fu.tripsense.recommendation.application.port.CandidateGenerator;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.Candidate;
import fu.tripsense.recommendation.domain.CandidateSource;
import fu.tripsense.recommendation.domain.GeoPoint;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import fu.tripsense.recommendation.domain.QuietnessEvidence;
import fu.tripsense.recommendation.domain.RecommendationContext;
import fu.tripsense.recommendation.domain.RetrievalEvidence;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class PlaceServiceCandidateGenerator
    implements CandidateGenerator,
        fu.tripsense.recommendation.application.port.CategoryCandidateSource {
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
            context.allowExternalRefresh());
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
    if (context.query() != null && !context.query().isBlank()) return context.query();
    return context.requiredCategories().stream().sorted().findFirst().orElse("");
  }

  public fu.tripsense.recommendation.application.port.CategoryCandidateSource.Batch
      generateCategories(
          RecommendationContext context,
          List<fu.tripsense.recommendation.domain.DiscoveryCategory> categories,
          int target) {
    var response =
        restClient
            .post()
            .uri(baseUrl + "/api/places/recommendations/categories")
            .body(
                new CategoryRequest(
                    context.anchor().lat(),
                    context.anchor().lng(),
                    context.radiusMeters(),
                    categories,
                    target,
                    maximumPlaceAgeSeconds,
                    List.of("id", "location", "categories"),
                    false))
            .retrieve()
            .body(CategoryEnvelope.class);
    if (response == null
        || !response.success()
        || response.data() == null
        || response.data().groups() == null)
      throw new IllegalStateException("Category retrieval unavailable");
    return new fu.tripsense.recommendation.application.port.CategoryCandidateSource.Batch(
        response.data().groups().stream()
            .filter(g -> g != null && categories.contains(g.category()))
            .limit(4)
            .map(
                g ->
                    new fu.tripsense.recommendation.application.port.CategoryCandidateSource.Group(
                        g.category(),
                        g.status(),
                        categoryCandidates(g).stream().limit(target).toList(),
                        g.degradations() == null ? List.of() : g.degradations()))
            .toList());
  }

  public List<Candidate> categoryCandidates(CategoryGroup group) {
    if (group == null || group.places() == null) return List.of();
    var evidence = mapEvidence(group.evidence());
    return java.util.stream.IntStream.range(0, Math.min(50, group.places().size()))
        .filter(i -> group.places().get(i) != null && group.places().get(i).id() != null)
        .mapToObj(
            i -> {
              var p = group.places().get(i).toDomain();
              return new Candidate(p.id(), source(), i + 1, null, p, evidence);
            })
        .toList();
  }

  record CategoryRequest(
      double lat,
      double lng,
      Integer radiusMeters,
      List<fu.tripsense.recommendation.domain.DiscoveryCategory> categories,
      int targetPerCategory,
      long maximumAgeSeconds,
      List<String> requiredFields,
      boolean allowExternalRefresh) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record CategoryEnvelope(boolean success, CategoryBatch data) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record CategoryBatch(List<CategoryGroup> groups) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record CategoryGroup(
      fu.tripsense.recommendation.domain.DiscoveryCategory category,
      String status,
      List<PlaceDto> places,
      EvidenceDto evidence,
      List<String> degradations) {}

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
      String freshness,
      String primaryType) {
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
          freshness,
          primaryType);
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
