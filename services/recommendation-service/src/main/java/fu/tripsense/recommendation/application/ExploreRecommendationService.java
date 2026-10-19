package fu.tripsense.recommendation.application;

import com.google.common.util.concurrent.Striped;
import fu.tripsense.recommendation.application.ExploreRecommendationResult.FallbackLevel;
import fu.tripsense.recommendation.application.ExploreRecommendationResult.Personalization;
import fu.tripsense.recommendation.application.ExploreRecommendationResult.ResultMode;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.GeoPoint;
import fu.tripsense.recommendation.domain.GeographicScope;
import fu.tripsense.recommendation.domain.RankingCriterion;
import fu.tripsense.recommendation.domain.RecommendationContext;
import fu.tripsense.recommendation.security.AuthenticatedUser;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.locks.Lock;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class ExploreRecommendationService {
  private final RecommendationApplicationService recommendations;
  private final ExploreRecommendationCache cache;
  private final ExploreQueryRelevancePolicy queryRelevance;
  private final RecommendationProperties.Explore properties;
  private final boolean intentPolicy;
  private final Striped<Lock> locks = Striped.lock(128);

  public ExploreRecommendationService(
      RecommendationApplicationService recommendations,
      ExploreRecommendationCache cache,
      ExploreQueryRelevancePolicy queryRelevance,
      RecommendationProperties properties) {
    this.recommendations = recommendations;
    this.cache = cache;
    this.queryRelevance = queryRelevance;
    this.properties = properties.getExplore();
    this.intentPolicy = properties.getProfile().isObservedSignalPolicyV2Enabled();
  }

  public ExploreRecommendationResult recommend(
      AuthenticatedUser user, String accessToken, ExploreRecommendationCommand request) {
    long startedAt = System.nanoTime();
    var destination = properties.getDestinations().get(request.destinationId());
    if (destination == null) throw new InvalidDestinationException();
    String query = request.normalizedQuery();
    RecommendationCommand command = command(user.id(), accessToken, request, destination, query);
    RequestDiagnostics.mark("query_present", !query.isBlank());
    RequestDiagnostics.mark("limit", request.effectiveLimit());
    // Both sources search existing data first; provider supplementation is evaluated after fusion.
    RecommendationContext context =
        RequestDiagnostics.measure("resolve_context", () -> recommendations.resolveContext(command))
            .withExternalRefresh(false)
            .withParallelRetrieval(true);
    RequestDiagnostics.mark("external_refresh_allowed", context.allowExternalRefresh());
    RequestDiagnostics.mark("provider_supplement_attempted", false);
    String profileFingerprint =
        RequestDiagnostics.measure(
            "profile_fingerprint", () -> cache.profileFingerprint(context.profile()));
    String lockKey =
        user.id() + "|" + request.destinationId() + "|" + query + "|" + profileFingerprint;
    Lock lock = locks.get(lockKey);
    RequestDiagnostics.run("lock_wait", lock::lock);
    try {
      var cached =
          RequestDiagnostics.measure(
              "cache_fresh_get",
              () ->
                  cache.getFresh(
                      user.id(),
                      request.destinationId(),
                      query,
                      profileFingerprint,
                      request.effectiveLimit()));
      RequestDiagnostics.mark("cache_hit", cached.isPresent());
      if (cached.isPresent()) {
        RequestDiagnostics.mark("fallback", cached.get().fallbackLevel());
        RequestDiagnostics.mark("returned", cached.get().recommendation().items().size());
        log.info(
            "explore_recommendation_completed destination={} cacheHit=true fallback={} returned={} durationMs={}",
            request.destinationId(),
            cached.get().fallbackLevel(),
            cached.get().recommendation().items().size(),
            elapsedMillis(startedAt));
        return cached.get();
      }

      RecommendationApplicationService.PreparedRecommendation selected;
      FallbackLevel level = FallbackLevel.EXACT;
      try {
        selected =
            RequestDiagnostics.measure(
                "exact", () -> applyQueryRelevance(query, recommendations.prepare(context)));
        int useful = Math.min(request.effectiveLimit(), properties.getMinimumUsefulResults());
        if (!query.isBlank()
            && selected.result().items().size() < useful
            && destination.getMaximumRadiusMeters() > destination.getDefaultRadiusMeters()) {
          var relaxed =
              RequestDiagnostics.measure(
                  "relaxed",
                  () ->
                      applyQueryRelevance(
                          query,
                          recommendations.prepare(
                              copy(
                                  context,
                                  context.query(),
                                  destination.getMaximumRadiusMeters(),
                                  context.rankingCriteria()))));
          if (relaxed.result().items().size() > selected.result().items().size()) {
            selected = relaxed;
            level = FallbackLevel.RELAXED_RETRIEVAL;
          }
        }
        if (selected.result().items().isEmpty()) {
          if (!query.isBlank()
              && !Thread.currentThread().isInterrupted()
              && internalSourcesAvailable(selected)) {
            RequestDiagnostics.mark("provider_supplement_attempted", true);
            try {
              var internal = selected;
              var supplemented =
                  RequestDiagnostics.measure(
                      "provider_supplement",
                      () ->
                          applyQueryRelevance(
                              query, recommendations.supplementWithProvider(internal)));
              if (!supplemented.result().items().isEmpty()) selected = supplemented;
            } catch (RuntimeException failure) {
              RequestDiagnostics.mark("provider_supplement_failed", true);
            }
          }
        }
        if (selected.result().items().isEmpty()) {
          selected =
              RequestDiagnostics.measure(
                  "baseline",
                  () ->
                      recommendations.prepare(
                          copy(
                                  context,
                                  baselineQuery(destination.getName()),
                                  destination.getMaximumRadiusMeters(),
                                  baseCriteria())
                              .withExternalRefresh(false)));
          level = FallbackLevel.DESTINATION_BASELINE;
        }
      } catch (RuntimeException exception) {
        RequestDiagnostics.mark("retrieval_failed", true);
        return RequestDiagnostics.measure(
                "cache_lkg_get",
                () ->
                    cache.getLastKnownGood(
                        user.id(),
                        request.destinationId(),
                        query,
                        profileFingerprint,
                        request.effectiveLimit()))
            .map(this::asLastKnownGood)
            .orElseThrow(() -> exception);
      }

      if (selected.result().items().isEmpty()) {
        var lastKnown =
            RequestDiagnostics.measure(
                "cache_lkg_get",
                () ->
                    cache.getLastKnownGood(
                        user.id(),
                        request.destinationId(),
                        query,
                        profileFingerprint,
                        request.effectiveLimit()));
        if (lastKnown.isPresent()) return asLastKnownGood(lastKnown.get());
      }

      var served = selected;
      RequestDiagnostics.run("impression_record", () -> recommendations.record(served));
      ExploreRecommendationResult response = response(request, selected, level);
      RequestDiagnostics.mark("fallback", level);
      RequestDiagnostics.mark("returned", selected.result().items().size());
      if (!selected.result().items().isEmpty()) {
        RequestDiagnostics.run(
            "cache_put",
            () ->
                cache.put(
                    user.id(),
                    request.destinationId(),
                    query,
                    profileFingerprint,
                    request.effectiveLimit(),
                    response));
      }
      log.info(
          "explore_recommendation_completed destination={} cacheHit=false fallback={} returned={} durationMs={}",
          request.destinationId(),
          level,
          selected.result().items().size(),
          elapsedMillis(startedAt));
      return response;
    } finally {
      lock.unlock();
    }
  }

  private RecommendationApplicationService.PreparedRecommendation applyQueryRelevance(
      String submittedQuery, RecommendationApplicationService.PreparedRecommendation prepared) {
    return submittedQuery.isBlank() ? prepared : queryRelevance.apply(prepared);
  }

  private boolean internalSourcesAvailable(
      RecommendationApplicationService.PreparedRecommendation prepared) {
    // Infrastructure failure is not evidence of missing inventory; avoid provider load escalation.
    return prepared.result().degradations().stream()
        .noneMatch(
            reason ->
                reason.endsWith("_UNAVAILABLE")
                    || reason.endsWith("_TIMEOUT")
                    || reason.endsWith("_REJECTED")
                    || reason.endsWith("_INTERRUPTED"));
  }

  private RecommendationCommand command(
      UUID userId,
      String token,
      ExploreRecommendationCommand request,
      RecommendationProperties.Destination destination,
      String query) {
    return new RecommendationCommand(
        userId,
        token,
        query.isBlank() ? defaultQuery(destination.getName()) : query,
        null,
        request.sessionId(),
        new GeoPoint(destination.getLat(), destination.getLng()),
        query.isBlank()
            ? destination.getMaximumRadiusMeters()
            : destination.getDefaultRadiusMeters(),
        Set.of(),
        Set.of(),
        Set.of(),
        new GeographicScope(destination.getName(), destination.getName(), null, true),
        query.isBlank() ? baseCriteria() : queryCriteria(),
        request.effectiveLimit(),
        "EXPLORE_RECOMMENDATION");
  }

  private RecommendationContext copy(
      RecommendationContext source,
      String query,
      int radiusMeters,
      List<RankingCriterion> criteria) {
    return new RecommendationContext(
        UUID.randomUUID(),
        source.userId(),
        source.tripId(),
        source.sessionId(),
        query,
        source.anchor(),
        radiusMeters,
        source.preferredCategories(),
        source.dislikedCategories(),
        source.requiredCategories(),
        source.geographicScope(),
        criteria,
        source.profile(),
        source.trip(),
        source.limit(),
        source.allowExternalRefresh(),
        source.parallelRetrieval());
  }

  private List<RankingCriterion> baseCriteria() {
    return List.of(
        criterion(RankingCriterion.Feature.PREFERENCE, RankingCriterion.Importance.HIGH),
        criterion(RankingCriterion.Feature.DISTANCE, RankingCriterion.Importance.MEDIUM),
        criterion(RankingCriterion.Feature.RATING, RankingCriterion.Importance.MEDIUM),
        criterion(RankingCriterion.Feature.POPULARITY, RankingCriterion.Importance.MEDIUM),
        criterion(RankingCriterion.Feature.HISTORY, RankingCriterion.Importance.LOW),
        criterion(RankingCriterion.Feature.RETRIEVAL_RELEVANCE, RankingCriterion.Importance.LOW));
  }

  private List<RankingCriterion> queryCriteria() {
    return List.of(
        criterion(RankingCriterion.Feature.RETRIEVAL_RELEVANCE, RankingCriterion.Importance.HIGH),
        criterion(RankingCriterion.Feature.SEMANTIC, RankingCriterion.Importance.HIGH),
        criterion(RankingCriterion.Feature.PREFERENCE, RankingCriterion.Importance.MEDIUM),
        criterion(RankingCriterion.Feature.DISTANCE, RankingCriterion.Importance.MEDIUM),
        criterion(RankingCriterion.Feature.RATING, RankingCriterion.Importance.LOW),
        criterion(RankingCriterion.Feature.POPULARITY, RankingCriterion.Importance.LOW));
  }

  private RankingCriterion criterion(
      RankingCriterion.Feature feature, RankingCriterion.Importance importance) {
    return new RankingCriterion(
        feature,
        feature == RankingCriterion.Feature.DISTANCE
            ? RankingCriterion.Direction.MINIMIZE
            : RankingCriterion.Direction.MAXIMIZE,
        importance);
  }

  private ExploreRecommendationResult response(
      ExploreRecommendationCommand request,
      RecommendationApplicationService.PreparedRecommendation selected,
      FallbackLevel level) {
    var profile = selected.context().profile();
    int signals = profile.personalizationSignalCount(!intentPolicy);
    boolean applied = profile.personalizationEnabled() && profile.available() && signals > 0;
    ResultMode mode =
        applied
            ? request.normalizedQuery().isBlank()
                ? ResultMode.PERSONALIZED
                : ResultMode.QUERY_PERSONALIZED
            : ResultMode.GENERIC_DESTINATION;
    return new ExploreRecommendationResult(
        request.destinationId(),
        request.normalizedQuery(),
        !request.normalizedQuery().isBlank(),
        mode,
        level,
        false,
        new Personalization(profile.personalizationEnabled(), applied, signals),
        selected.result());
  }

  private ExploreRecommendationResult asLastKnownGood(ExploreRecommendationResult value) {
    RequestDiagnostics.mark("fallback", FallbackLevel.LAST_KNOWN_GOOD);
    RequestDiagnostics.mark("returned", value.recommendation().items().size());
    return new ExploreRecommendationResult(
        value.destinationId(),
        value.committedQuery(),
        value.queryApplied(),
        value.resultMode(),
        FallbackLevel.LAST_KNOWN_GOOD,
        true,
        value.personalization(),
        value.recommendation());
  }

  private String defaultQuery(String destinationName) {
    return "địa điểm nổi tiếng ở " + destinationName;
  }

  private String baselineQuery(String destinationName) {
    return "điểm tham quan ở " + destinationName;
  }

  private long elapsedMillis(long startedAt) {
    return (System.nanoTime() - startedAt) / 1_000_000;
  }
}
