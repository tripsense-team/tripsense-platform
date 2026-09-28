package fu.tripsense.recommendation.application;

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
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class ExploreRecommendationService {
  private final RecommendationApplicationService recommendations;
  private final ExploreRecommendationCache cache;
  private final ExploreQueryRelevancePolicy queryRelevance;
  private final RecommendationProperties.Explore properties;
  private final ConcurrentHashMap<String, ReentrantLock> locks = new ConcurrentHashMap<>();

  public ExploreRecommendationService(
      RecommendationApplicationService recommendations,
      ExploreRecommendationCache cache,
      ExploreQueryRelevancePolicy queryRelevance,
      RecommendationProperties properties) {
    this.recommendations = recommendations;
    this.cache = cache;
    this.queryRelevance = queryRelevance;
    this.properties = properties.getExplore();
  }

  public ExploreRecommendationResult recommend(
      AuthenticatedUser user, String accessToken, ExploreRecommendationCommand request) {
    long startedAt = System.nanoTime();
    var destination = properties.getDestinations().get(request.destinationId());
    if (destination == null) throw new InvalidDestinationException();
    String query = request.normalizedQuery();
    RecommendationCommand command = command(user.id(), accessToken, request, destination, query);
    RecommendationContext context = recommendations.resolveContext(command);
    String profileFingerprint = cache.profileFingerprint(context.profile());
    String lockKey = user.id() + "|" + request.destinationId() + "|" + query + "|" + profileFingerprint;
    ReentrantLock lock = locks.computeIfAbsent(lockKey, ignored -> new ReentrantLock());
    lock.lock();
    try {
      var cached =
          cache.getFresh(
              user.id(),
              request.destinationId(),
              query,
              profileFingerprint,
              request.effectiveLimit());
      if (cached.isPresent()) {
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
        selected = applyQueryRelevance(query, recommendations.prepare(context));
        int useful = Math.min(request.effectiveLimit(), properties.getMinimumUsefulResults());
        if (!query.isBlank()
            && selected.result().items().size() < useful
            && destination.getMaximumRadiusMeters() > destination.getDefaultRadiusMeters()) {
          var relaxed =
              applyQueryRelevance(
                  query,
                  recommendations.prepare(
                      copy(
                          context,
                          context.query(),
                          destination.getMaximumRadiusMeters(),
                          context.rankingCriteria())));
          if (relaxed.result().items().size() > selected.result().items().size()) {
            selected = relaxed;
            level = FallbackLevel.RELAXED_RETRIEVAL;
          }
        }
        if (selected.result().items().isEmpty()) {
          selected =
              recommendations.prepare(
                  copy(
                      context,
                      baselineQuery(destination.getName()),
                      destination.getMaximumRadiusMeters(),
                      baseCriteria()));
          level = FallbackLevel.DESTINATION_BASELINE;
        }
      } catch (RuntimeException exception) {
        return cache
            .getLastKnownGood(
                user.id(),
                request.destinationId(),
                query,
                profileFingerprint,
                request.effectiveLimit())
            .map(this::asLastKnownGood)
            .orElseThrow(() -> exception);
      }

      if (selected.result().items().isEmpty()) {
        var lastKnown =
            cache.getLastKnownGood(
                user.id(),
                request.destinationId(),
                query,
                profileFingerprint,
                request.effectiveLimit());
        if (lastKnown.isPresent()) return asLastKnownGood(lastKnown.get());
      }

      recommendations.record(selected);
      ExploreRecommendationResult response = response(request, selected, level);
      if (!selected.result().items().isEmpty()) {
        cache.put(
            user.id(),
            request.destinationId(),
            query,
            profileFingerprint,
            request.effectiveLimit(),
            response);
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
      if (!lock.hasQueuedThreads()) locks.remove(lockKey, lock);
    }
  }

  private RecommendationApplicationService.PreparedRecommendation applyQueryRelevance(
      String submittedQuery,
      RecommendationApplicationService.PreparedRecommendation prepared) {
    return submittedQuery.isBlank() ? prepared : queryRelevance.apply(prepared);
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
        source.limit());
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
    int signals =
        Math.max(profile.preferredCategories().size(), profile.categoryAffinities().size());
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
