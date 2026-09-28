package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fu.tripsense.recommendation.application.RecommendationApplicationService.PreparedRecommendation;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.AlgorithmVersions;
import fu.tripsense.recommendation.domain.GeoPoint;
import fu.tripsense.recommendation.domain.RecommendationContext;
import fu.tripsense.recommendation.domain.RecommendationResult;
import fu.tripsense.recommendation.domain.UserProfileSnapshot;
import fu.tripsense.recommendation.security.AuthenticatedUser;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ExploreRecommendationServiceTest {
  private final RecommendationApplicationService recommendations =
      mock(RecommendationApplicationService.class);
  private final ExploreRecommendationCache cache = mock(ExploreRecommendationCache.class);
  private final RecommendationProperties properties = new RecommendationProperties();
  private final ExploreRecommendationService service =
      new ExploreRecommendationService(
          recommendations, cache, new ExploreQueryRelevancePolicy(properties), properties);

  @Test
  void rejectsUnknownDestination() {
    assertThatThrownBy(
            () ->
                service.recommend(
                    new AuthenticatedUser(UUID.randomUUID(), "USER"),
                    "token",
                    new ExploreRecommendationCommand("unknown", "", "explore.test", 20)))
        .isInstanceOf(InvalidDestinationException.class);
  }

  @Test
  void usesExplorePurposeAndReturnsFreshCachedResponse() {
    UUID userId = UUID.randomUUID();
    RecommendationContext context = context(userId);
    ExploreRecommendationResult cached = cached();
    when(recommendations.resolveContext(any())).thenReturn(context);
    when(cache.profileFingerprint(context.profile())).thenReturn("profile-v1");
    when(cache.getFresh(userId, "danang", "cafe", "profile-v1", 20))
        .thenReturn(Optional.of(cached));

    ExploreRecommendationResult result =
        service.recommend(
            new AuthenticatedUser(userId, "USER"),
            "token",
            new ExploreRecommendationCommand("danang", " cafe ", "explore.test", 20));

    assertThat(result).isSameAs(cached);
    ArgumentCaptor<RecommendationCommand> command =
        ArgumentCaptor.forClass(RecommendationCommand.class);
    verify(recommendations).resolveContext(command.capture());
    assertThat(command.getValue().preferencePurpose()).isEqualTo("EXPLORE_RECOMMENDATION");
    assertThat(command.getValue().query()).isEqualTo("cafe");
    assertThat(command.getValue().anchor()).isEqualTo(new GeoPoint(16.0544, 108.2022));
  }

  @Test
  void blankForYouFallsBackToDestinationBaselineAndDoesNotCacheEmptyResult() {
    UUID userId = UUID.randomUUID();
    RecommendationContext context = context(userId);
    RecommendationResult emptyResult =
        new RecommendationResult(
            UUID.randomUUID(),
            context.requestId(),
            List.of(),
            new AlgorithmVersions("r", "f", "e", "feature", "rank", "d"),
            List.of());
    when(recommendations.resolveContext(any())).thenReturn(context);
    when(cache.profileFingerprint(context.profile())).thenReturn("profile-v1");
    when(cache.getFresh(userId, "danang", "", "profile-v1", 20)).thenReturn(Optional.empty());
    when(cache.getLastKnownGood(userId, "danang", "", "profile-v1", 20))
        .thenReturn(Optional.empty());
    when(recommendations.prepare(any(RecommendationContext.class)))
        .thenAnswer(
            invocation ->
                new PreparedRecommendation(
                    invocation.getArgument(0, RecommendationContext.class), emptyResult));

    ExploreRecommendationResult result =
        service.recommend(
            new AuthenticatedUser(userId, "USER"),
            "token",
            new ExploreRecommendationCommand("danang", "", "explore.test", 20));

    ArgumentCaptor<RecommendationCommand> command =
        ArgumentCaptor.forClass(RecommendationCommand.class);
    verify(recommendations).resolveContext(command.capture());
    assertThat(command.getValue().radiusMeters()).isEqualTo(35_000);
    ArgumentCaptor<RecommendationContext> contexts =
        ArgumentCaptor.forClass(RecommendationContext.class);
    verify(recommendations, org.mockito.Mockito.atLeastOnce()).prepare(contexts.capture());
    assertThat(contexts.getAllValues())
        .extracting(RecommendationContext::query)
        .contains("điểm tham quan ở Đà Nẵng");
    assertThat(result.fallbackLevel())
        .isEqualTo(ExploreRecommendationResult.FallbackLevel.DESTINATION_BASELINE);
    verify(cache, never()).put(any(), any(), any(), any(), anyInt(), any());
  }

  private RecommendationContext context(UUID userId) {
    UserProfileSnapshot profile =
        new UserProfileSnapshot(
            true,
            true,
            Set.of("cafe"),
            Set.of(),
            Map.of("cafe", 1.0),
            Set.of(),
            Set.of(),
            Set.of(),
            Set.of(),
            Instant.parse("2026-09-28T00:00:00Z"));
    return new RecommendationContext(
        UUID.randomUUID(),
        userId,
        null,
        "explore.test",
        "cafe",
        new GeoPoint(16.0544, 108.2022),
        12_000,
        Set.of(),
        Set.of(),
        Set.of(),
        null,
        List.of(),
        profile,
        null,
        20);
  }

  private ExploreRecommendationResult cached() {
    return new ExploreRecommendationResult(
        "danang",
        "cafe",
        true,
        ExploreRecommendationResult.ResultMode.QUERY_PERSONALIZED,
        ExploreRecommendationResult.FallbackLevel.EXACT,
        false,
        new ExploreRecommendationResult.Personalization(true, true, 1),
        new RecommendationResult(
            UUID.randomUUID(),
            UUID.randomUUID(),
            List.of(),
            new AlgorithmVersions("r", "f", "e", "feature", "rank", "d"),
            List.of()));
  }
}
