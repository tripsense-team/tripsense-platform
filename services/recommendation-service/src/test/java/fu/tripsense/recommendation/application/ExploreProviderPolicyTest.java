package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import fu.tripsense.recommendation.application.RecommendationApplicationService.PreparedRecommendation;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.AlgorithmVersions;
import fu.tripsense.recommendation.domain.GeoPoint;
import fu.tripsense.recommendation.domain.RankedCandidate;
import fu.tripsense.recommendation.domain.RecommendationContext;
import fu.tripsense.recommendation.domain.RecommendationResult;
import fu.tripsense.recommendation.security.AuthenticatedUser;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

class ExploreProviderPolicyTest {
  private final RecommendationApplicationService recommendations =
      mock(RecommendationApplicationService.class);
  private final ExploreRecommendationCache cache = mock(ExploreRecommendationCache.class);
  private final ExploreQueryRelevancePolicy relevance = mock(ExploreQueryRelevancePolicy.class);
  private final RecommendationProperties properties = new RecommendationProperties();
  private final ExploreRecommendationService service =
      new ExploreRecommendationService(recommendations, cache, relevance, properties);
  private final UUID userId = UUID.randomUUID();
  private final RecommendationContext resolved =
      new RecommendationContext(
          UUID.randomUUID(),
          userId,
          null,
          "test",
          "generated nonblank city query",
          new GeoPoint(16.0544, 108.2022),
          12_000,
          Set.of(),
          Set.of(),
          null,
          null,
          48);

  private void prepare(int count) {
    when(recommendations.resolveContext(any())).thenReturn(resolved);
    when(recommendations.prepare(any(RecommendationContext.class)))
        .thenAnswer(
            call -> {
              RecommendationContext context = call.getArgument(0);
              var result =
                  new RecommendationResult(
                      UUID.randomUUID(),
                      context.requestId(),
                      Collections.nCopies(count, new RankedCandidate(null, 0, null, List.of())),
                      new AlgorithmVersions("r", "f", "e", "features", "rank", "diversity"),
                      List.of());
              return new PreparedRecommendation(context, result);
            });
    when(relevance.apply(any())).thenAnswer(call -> call.getArgument(0));
  }

  private ExploreRecommendationResult run(String query) {
    return service.recommend(
        new AuthenticatedUser(userId, "USER"),
        "token",
        new ExploreRecommendationCommand("danang", query, "test", 48));
  }

  private List<RecommendationContext> contexts(int count) {
    var captured = ArgumentCaptor.forClass(RecommendationContext.class);
    verify(recommendations, times(count)).prepare(captured.capture());
    return captured.getAllValues();
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {"  \t "})
  void baseReturnsFortyWithoutTopUpDespiteGeneratedNonblankQuery(String query) {
    prepare(40);
    var result = run(query);
    var context = contexts(1).getFirst();
    assertThat(context.query()).isNotBlank();
    assertThat(context.allowExternalRefresh()).isFalse();
    assertThat(resolved.allowExternalRefresh()).isTrue();
    assertThat(result.recommendation().items()).hasSize(40);
    assertThat(result.queryApplied()).isFalse();
    verify(recommendations).record(any());
    verifyNoInteractions(relevance);
  }

  @Test
  void baseWithOneResultStillDoesNotTopUp() {
    prepare(1);
    assertThat(run("").recommendation().items()).hasSize(1);
    assertThat(contexts(1)).allMatch(c -> !c.allowExternalRefresh());
  }

  @Test
  void emptyBaseBaselineNeverEnablesProvider() {
    prepare(0);
    assertThat(run("").recommendation().items()).isEmpty();
    assertThat(contexts(2)).allMatch(c -> !c.allowExternalRefresh());
    verify(cache, never()).put(any(), any(), any(), any(), anyInt(), any());
  }

  @Test
  void submittedQueryUsesInternalSourcesAndDoesNotSupplementFortyResults() {
    prepare(40);
    assertThat(run(" cafe ").recommendation().items()).hasSize(40);
    assertThat(contexts(1).getFirst().allowExternalRefresh()).isFalse();
    assertThat(contexts(1).getFirst().parallelRetrieval()).isTrue();
    verify(recommendations, never()).supplementWithProvider(any());
    var command = ArgumentCaptor.forClass(RecommendationCommand.class);
    verify(recommendations).resolveContext(command.capture());
    assertThat(command.getValue().query()).isEqualTo("cafe");
  }

  @Test
  void emptySearchTriesOneSupplementAfterInternalStagesAndKeepsBaselineLocal() {
    prepare(0);
    when(recommendations.supplementWithProvider(any())).thenAnswer(call -> call.getArgument(0));
    var result = run("cafe");
    var contexts = contexts(3);
    assertThat(contexts)
        .extracting(RecommendationContext::allowExternalRefresh)
        .containsExactly(false, false, false);
    assertThat(contexts).allMatch(RecommendationContext::parallelRetrieval);
    verify(recommendations, times(1)).supplementWithProvider(any());
    assertThat(contexts.get(1).radiusMeters()).isEqualTo(35_000);
    assertThat(contexts.get(2).query()).isEqualTo("điểm tham quan ở Đà Nẵng");
    assertThat(result.fallbackLevel())
        .isEqualTo(ExploreRecommendationResult.FallbackLevel.DESTINATION_BASELINE);
    verify(recommendations, times(1)).record(any());
  }

  @Test
  void oneUsefulSearchResultDoesNotTriggerProviderToFillCards() {
    prepare(1);
    assertThat(run("cafe").recommendation().items()).hasSize(1);
    verify(recommendations, never()).supplementWithProvider(any());
    assertThat(contexts(2)).allMatch(c -> !c.allowExternalRefresh());
    verify(recommendations, times(1)).record(any());
  }

  @Test
  void failedSupplementContinuesLocalBaselineAndRecordsOnlyFinalResult() {
    prepare(0);
    when(recommendations.supplementWithProvider(any())).thenThrow(new IllegalStateException());
    assertThat(run("cafe").recommendation().items()).isEmpty();
    verify(recommendations, times(1)).supplementWithProvider(any());
    assertThat(contexts(3)).allMatch(c -> !c.allowExternalRefresh());
    verify(recommendations, times(1)).record(any());
  }

  @Test
  void successfulSupplementIsSelectedWithoutGenericBaseline() {
    prepare(0);
    when(recommendations.supplementWithProvider(any()))
        .thenAnswer(
            call -> {
              PreparedRecommendation original = call.getArgument(0);
              return new PreparedRecommendation(
                  original.context(),
                  new RecommendationResult(
                      UUID.randomUUID(),
                      original.context().requestId(),
                      List.of(new RankedCandidate(null, 0, null, List.of())),
                      original.result().versions(),
                      List.of()));
            });
    assertThat(run("cafe").recommendation().items()).hasSize(1);
    contexts(2);
    verify(recommendations, times(1)).record(any());
  }

  @Test
  void exhaustedExecutorIsNotTreatedAsMissingInventoryForProvider() {
    prepare(0);
    when(recommendations.prepare(any(RecommendationContext.class)))
        .thenAnswer(
            call -> {
              RecommendationContext context = call.getArgument(0);
              return new PreparedRecommendation(
                  context,
                  new RecommendationResult(
                      UUID.randomUUID(),
                      context.requestId(),
                      List.of(),
                      new AlgorithmVersions("r", "f", "e", "feature", "rank", "d"),
                      List.of("PLACE_RETRIEVAL_REJECTED", "SEMANTIC_REJECTED")));
            });
    assertThat(run("cafe").recommendation().items()).isEmpty();
    verify(recommendations, never()).supplementWithProvider(any());
  }

  @Test
  void baseFreshCacheHitSkipsAllRetrievalAndNewImpression() {
    when(recommendations.resolveContext(any())).thenReturn(resolved);
    when(cache.profileFingerprint(any())).thenReturn("fingerprint");
    var cached = mock(ExploreRecommendationResult.class);
    when(cached.recommendation())
        .thenReturn(
            new RecommendationResult(
                UUID.randomUUID(),
                UUID.randomUUID(),
                List.of(),
                new AlgorithmVersions("r", "f", "e", "features", "rank", "d"),
                List.of()));
    when(cache.getFresh(userId, "danang", "", "fingerprint", 48)).thenReturn(Optional.of(cached));
    assertThat(run("")).isSameAs(cached);
    verify(recommendations, never()).prepare(any(RecommendationContext.class));
    verify(recommendations, never()).record(any());
  }
}
