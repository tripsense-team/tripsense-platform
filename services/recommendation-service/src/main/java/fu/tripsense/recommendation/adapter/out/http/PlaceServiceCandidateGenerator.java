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
import java.util.ArrayList;
import java.util.HashMap;
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
  private final boolean mediaReadyOnly;
  private final int mediaMinimumReadyCandidates;
  private final double mediaMinimumCoverage;

  public PlaceServiceCandidateGenerator(
      RestClient recommendationRestClient, RecommendationProperties properties) {
    this.restClient = recommendationRestClient;
    this.baseUrl = properties.getDownstream().getPlaceUrl();
    this.sourceLimit = properties.getRetrieval().getSourceLimit();
    this.candidateMultiplier = properties.getRetrieval().getCandidateMultiplier();
    this.maximumPlaceAgeSeconds = properties.getRetrieval().getMaximumPlaceAge().toSeconds();
    this.mediaReadyOnly = properties.getRetrieval().isMediaReadyOnly();
    this.mediaMinimumReadyCandidates = properties.getRetrieval().getMediaMinimumReadyCandidates();
    this.mediaMinimumCoverage = properties.getRetrieval().getMediaMinimumCoverage();
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
    int target = Math.min(sourceLimit, Math.max(context.limit() * candidateMultiplier, context.limit()));
    PlaceRequest request =
        new PlaceRequest(
            retrievalQuery(context),
            context.anchor() == null ? null : context.anchor().lat(),
            context.anchor() == null ? null : context.anchor().lng(),
            context.radiusMeters(),
            mediaReadyOnly ? Math.max(target, mediaMinimumReadyCandidates) : target,
            List.of("id", "location", "categories"),
            maximumPlaceAgeSeconds,
            context.allowExternalRefresh(),
            false);
    try {
      Envelope envelope = fetchRecommendations(request);
      if (envelope == null || !envelope.success() || envelope.data() == null) {
        throw new IllegalStateException("Place response has no data");
      }
      boolean gateDeferred = false;
      if (mediaReadyOnly) {
        if (meetsMediaThreshold(envelope.data().candidates())) {
          try {
            Envelope ready = fetchRecommendations(new PlaceRequest(
                request.query(), request.lat(), request.lng(), request.radiusMeters(),
                request.targetCount(), request.requiredFields(), request.maximumAgeSeconds(),
                false, true));
            if (ready != null && ready.success() && ready.data() != null
                && ready.data().candidates().size() >= mediaMinimumReadyCandidates
                && ready.data().candidates().size()
                    >= envelope.data().candidates().size() * mediaMinimumCoverage
                && ready.data().candidates().stream().allMatch(this::isReady)) {
              envelope = ready;
            } else {
              gateDeferred = true;
            }
          } catch (RuntimeException ignored) {
            gateDeferred = true;
          }
        } else {
          gateDeferred = true;
        }
      }
      RetrievalEvidence evidence = mapEvidence(envelope.data().evidence());
      ResultDto selectedData = envelope.data();
      List<Candidate> candidates =
          java.util.stream.IntStream.range(0, Math.min(target, selectedData.candidates().size()))
              .mapToObj(
                  index -> {
                    PlaceDto place = selectedData.candidates().get(index);
                    return new Candidate(
                        place.id(), source(), index + 1, null, place.toDomain(), evidence);
                  })
              .toList();
      List<String> degradations = new ArrayList<>(
          evidence == null || "SUFFICIENT".equals(evidence.status())
              ? List.of()
              : List.of("PLACE_RETRIEVAL_" + evidence.status()));
      if (gateDeferred) degradations.add("MEDIA_GATE_BELOW_SAFE_THRESHOLD");
      return new CandidateGenerationResult(source(), candidates, degradations);
    } catch (RuntimeException exception) {
      throw new DownstreamServiceException("place-service", exception);
    }
  }

  private Envelope fetchRecommendations(PlaceRequest request) {
    return restClient.post().uri(baseUrl + "/api/places/recommendations")
        .body(request).retrieve().body(Envelope.class);
  }

  private boolean isReady(PlaceDto place) {
    return place != null && place.media() != null && "READY".equals(place.media().state());
  }

  private boolean meetsMediaThreshold(List<PlaceDto> places) {
    if (places == null || places.size() < mediaMinimumReadyCandidates) return false;
    long ready = places.stream().filter(this::isReady).count();
    return ready >= mediaMinimumReadyCandidates
        && ready >= places.size() * mediaMinimumCoverage;
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
    CategoryRequest request = new CategoryRequest(
        context.anchor().lat(), context.anchor().lng(), context.radiusMeters(), categories,
        mediaReadyOnly ? Math.max(target, mediaMinimumReadyCandidates) : target,
        maximumPlaceAgeSeconds, List.of("id", "location", "categories"), false, false);
    var response = fetchCategories(request);
    if (response == null
        || !response.success()
        || response.data() == null
        || response.data().groups() == null)
      throw new IllegalStateException("Category retrieval unavailable");
    var readyByCategory = new HashMap<fu.tripsense.recommendation.domain.DiscoveryCategory, CategoryGroup>();
    var baselineByCategory = new HashMap<fu.tripsense.recommendation.domain.DiscoveryCategory, CategoryGroup>();
    if (mediaReadyOnly) {
      response.data().groups().stream().filter(g -> g != null && g.category() != null)
          .forEach(g -> baselineByCategory.put(g.category(), g));
      List<fu.tripsense.recommendation.domain.DiscoveryCategory> eligible = response.data().groups()
          .stream().filter(g -> g != null && meetsMediaThreshold(g.places()))
          .map(CategoryGroup::category).toList();
      if (!eligible.isEmpty()) {
        try {
          CategoryEnvelope ready = fetchCategories(new CategoryRequest(
              request.lat(), request.lng(), request.radiusMeters(), eligible,
              request.targetPerCategory(), request.maximumAgeSeconds(), request.requiredFields(),
              false, true));
          if (ready != null && ready.success() && ready.data() != null && ready.data().groups() != null) {
            for (CategoryGroup group : ready.data().groups()) {
              if (group != null && group.category() != null
                  && baselineByCategory.containsKey(group.category())
                  && group.places() != null
                  && group.places().size() >= mediaMinimumReadyCandidates
                  && group.places().size() >= baselineByCategory.get(group.category())
                      .places().size() * mediaMinimumCoverage
                  && group.places().stream().allMatch(this::isReady)) {
                readyByCategory.put(group.category(), group);
              }
            }
          }
        } catch (RuntimeException ignored) {
          // Baseline groups remain available when the optional gate cannot be applied.
        }
      }
    }
    return new fu.tripsense.recommendation.application.port.CategoryCandidateSource.Batch(
        response.data().groups().stream()
            .filter(g -> g != null && categories.contains(g.category()))
            .limit(4)
            .map(
                g -> {
                  CategoryGroup selected = readyByCategory.getOrDefault(g.category(), g);
                  List<String> degradations = new ArrayList<>(
                      selected.degradations() == null ? List.of() : selected.degradations());
                  if (mediaReadyOnly && selected == g)
                    degradations.add("MEDIA_GATE_BELOW_SAFE_THRESHOLD");
                  return
                    new fu.tripsense.recommendation.application.port.CategoryCandidateSource.Group(
                        selected.category(), selected.status(),
                        categoryCandidates(selected).stream().limit(target).toList(), degradations);
                })
            .toList());
  }

  private CategoryEnvelope fetchCategories(CategoryRequest request) {
    return restClient.post().uri(baseUrl + "/api/places/recommendations/categories")
        .body(request).retrieve().body(CategoryEnvelope.class);
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
      boolean allowExternalRefresh,
      boolean mediaReadyOnly) {}

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
      boolean allowExternalRefresh,
      boolean mediaReadyOnly) {}

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
      String primaryType,
      fu.tripsense.recommendation.domain.PriceEvidence priceEvidence,
      MediaDto media) {
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
          primaryType,
          priceEvidence);
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  record MediaDto(String state) {}

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
