package fu.tripsense.recommendation.api;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.algorithm.fusion.ReciprocalRankFusionStrategy;
import fu.tripsense.recommendation.algorithm.ranking.HeuristicRanker;
import fu.tripsense.recommendation.api.dto.*;
import fu.tripsense.recommendation.application.*;
import fu.tripsense.recommendation.application.port.*;
import fu.tripsense.recommendation.config.*;
import fu.tripsense.recommendation.domain.*;
import fu.tripsense.recommendation.security.AuthenticatedUser;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.data.redis.core.*;

class SectionFeedServiceTest {
  private final ExecutorService pool = Executors.newFixedThreadPool(2);
  private final RecommendationProperties properties = new RecommendationProperties();
  private final SectionFeedProperties settings = new SectionFeedProperties();
  private final RecommendationContextProvider contextProvider =
      mock(RecommendationContextProvider.class);
  private final CategoryCandidateSource place = mock(CategoryCandidateSource.class);
  private final CandidateGenerator semantic = mock(CandidateGenerator.class);
  private final PlaceSnapshotResolver snapshots = mock(PlaceSnapshotResolver.class);
  private final ImpressionRecorder recorder = mock(ImpressionRecorder.class);
  private final FeaturePipeline features = spy(new FeaturePipeline(List.of()));
  private final StringRedisTemplate redis = mock(StringRedisTemplate.class);
  private final ValueOperations<String, String> values = mock(ValueOperations.class);
  private final Map<String, String> storage = new ConcurrentHashMap<>();
  private final AuthenticatedUser user = new AuthenticatedUser(UUID.randomUUID(), "USER");
  private final Map<DiscoveryCategory, List<Candidate>> inventory =
      new EnumMap<>(DiscoveryCategory.class);
  private UserProfileSnapshot profile = UserProfileSnapshot.coldStart(true);
  private SectionFeedCache cache;
  private SectionFeedService service;

  @BeforeEach
  void setup() {
    properties.getExplore().setCacheKeySecret("private-test-secret");
    when(redis.opsForValue()).thenReturn(values);
    when(values.get(anyString())).thenAnswer(i -> storage.get(i.getArgument(0)));
    doAnswer(
            i -> {
              storage.put(i.getArgument(0), i.getArgument(1));
              return null;
            })
        .when(values)
        .set(anyString(), anyString(), any(Duration.class));
    cache =
        new SectionFeedCache(
            redis, new ObjectMapper().findAndRegisterModules(), properties, settings);
    when(contextProvider.resolve(any()))
        .thenAnswer(
            i -> {
              RecommendationCommand c = i.getArgument(0);
              return new RecommendationContext(
                  UUID.randomUUID(),
                  c.userId(),
                  null,
                  c.sessionId(),
                  c.query(),
                  c.anchor(),
                  c.radiusMeters(),
                  Set.of(),
                  Set.of(),
                  Set.of(),
                  c.geographicScope(),
                  c.rankingCriteria(),
                  profile,
                  null,
                  48,
                  false,
                  true);
            });
    when(semantic.source()).thenReturn(CandidateSource.SEMANTIC);
    when(semantic.generate(any()))
        .thenReturn(new CandidateGenerationResult(CandidateSource.SEMANTIC, List.of(), List.of()));
    when(semantic.generateBounded(any(), eq(50)))
        .thenAnswer(i -> semantic.generate(i.getArgument(0)));
    when(place.generateCategories(any(), anyList(), anyInt()))
        .thenAnswer(
            i -> {
              List<DiscoveryCategory> categories = i.getArgument(1);
              return new CategoryCandidateSource.Batch(
                  categories.stream()
                      .map(
                          c ->
                              new CategoryCandidateSource.Group(
                                  c, "READY", inventory.getOrDefault(c, List.of()), List.of()))
                      .toList());
            });
    when(snapshots.resolveLocalBatch(anyList()))
        .thenAnswer(
            i -> {
              Map<String, PlaceSnapshot> result = new HashMap<>();
              inventory.values().stream()
                  .flatMap(List::stream)
                  .forEach(c -> result.put(c.placeId(), c.place()));
              return result;
            });
    var engine =
        new RecommendationApplicationService(
            contextProvider,
            mock(CandidateRetrievalPipeline.class),
            new ReciprocalRankFusionStrategy(properties),
            new CandidateFilterPipeline(List.of()),
            new CandidateEvidenceEnrichmentPipeline(),
            features,
            new HeuristicRanker(properties),
            (c, ranked, limit) -> ranked.stream().limit(limit).toList(),
            recorder,
            new AlgorithmVersionCatalog(properties),
            mock(RecommendationObservability.class));
    service =
        new SectionFeedService(
            engine,
            place,
            List.of(semantic),
            snapshots,
            pool,
            cache,
            new ExploreRecommendationCache(
                redis, new ObjectMapper().findAndRegisterModules(), properties),
            properties,
            settings);
    for (var category : DiscoveryCategory.preview())
      inventory.put(category, candidates(category, 8));
  }

  @AfterEach
  void stop() throws Exception {
    pool.shutdownNow();
    assertThat(pool.awaitTermination(2, TimeUnit.SECONDS)).isTrue();
  }

  private SectionFeedRequest request(DiscoveryCategory category, UUID seed) {
    return new SectionFeedRequest(
        "danang", "explore.test", category, category == null ? 4 : 48, seed);
  }

  private List<Candidate> candidates(DiscoveryCategory category, int count) {
    return java.util.stream.IntStream.range(0, count)
        .mapToObj(
            i -> {
              String id = category + "-" + i;
              var p =
                  new PlaceSnapshot(
                      id,
                      "test",
                      id,
                      id,
                      new GeoPoint(16.0544, 108.2022),
                      "address",
                      "Đà Nẵng",
                      null,
                      List.of(
                          category == DiscoveryCategory.FOOD
                              ? "restaurant"
                              : category.name().toLowerCase(Locale.ROOT)),
                      4.5,
                      20,
                      List.of(),
                      null,
                      "OPERATIONAL",
                      null,
                      Instant.now(),
                      "FRESH");
              return new Candidate(id, CandidateSource.PLACE_RETRIEVAL, i + 1, null, p, null);
            })
        .toList();
  }

  private SectionFeedResponse recommend(
      AuthenticatedUser user, String token, SectionFeedRequest r) {
    return SectionFeedResponse.from(
        service.recommend(
            user,
            token,
            new SectionFeedCommand(
                r.destinationId(), r.sessionId(), r.section(), r.limit(), r.seedId())));
  }

  @Test
  void coldPreviewUsesOneSharedProfileFeaturesBatchSemanticAndImpression() {
    var response = recommend(user, "token", request(null, null));
    assertThat(response.sections())
        .extracting(SectionFeedResponse.Section::category)
        .containsExactlyElementsOf(DiscoveryCategory.preview());
    assertThat(response.returnedCount()).isEqualTo(16);
    assertThat(response.sections()).allMatch(s -> s.items().size() == 4);
    assertThat(
            response.sections().stream()
                .flatMap(s -> s.items().stream())
                .map(RecommendationResponse.Item::rank))
        .containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(1, 16).boxed().toList());
    verify(contextProvider, times(1)).resolve(any());
    verify(features, times(1)).extract(any(), anyList());
    verify(place, times(1)).generateCategories(any(), eq(DiscoveryCategory.preview()), eq(12));
    verify(semantic, times(1)).generate(argThat(c -> !c.allowExternalRefresh()));
    verify(recorder, times(1)).record(any(), any());
    assertThat(response.seedId()).isNotNull();
  }

  @Test
  void tabReusesSeedSemanticButOnlySupplementsSelectedCategory() {
    var preview = recommend(user, "token", request(null, null));
    var expanded = recommend(user, "token", request(DiscoveryCategory.CAFE, preview.seedId()));
    assertThat(expanded.seedReused()).isTrue();
    assertThat(expanded.previewOrderPreserved()).isTrue();
    assertThat(expanded.sections()).hasSize(1);
    assertThat(expanded.sections().getFirst().items().stream().limit(4).map(i -> i.place().id()))
        .containsExactlyElementsOf(
            preview.sections().get(3).items().stream().map(i -> i.place().id()).toList());
    verify(semantic, times(1)).generate(any());
    verify(place).generateCategories(any(), eq(List.of(DiscoveryCategory.CAFE)), eq(50));
  }

  @Test
  void passiveImpressionsDoNotInvalidateCandidateReuseButNegativeFeedbackRemovesItem() {
    var preview = recommend(user, "token", request(null, null));
    String excluded = preview.sections().get(3).items().getFirst().place().id();
    profile =
        new UserProfileSnapshot(
            true,
            true,
            Set.of(),
            Set.of(),
            Map.of(),
            Set.of(excluded),
            Set.of(),
            Set.of(),
            Set.of(excluded),
            Instant.now());
    var expanded = recommend(user, "token", request(DiscoveryCategory.CAFE, preview.seedId()));
    assertThat(expanded.seedReused()).isTrue();
    assertThat(expanded.previewOrderPreserved()).isFalse();
    assertThat(expanded.sections().getFirst().items())
        .noneMatch(i -> i.place().id().equals(excluded));
    verify(semantic, times(1)).generate(any());
  }

  @Test
  void foreignSeedIsNotAccessible() {
    var preview = recommend(user, "token", request(null, null));
    assertThatThrownBy(
            () ->
                recommend(
                    new AuthenticatedUser(UUID.randomUUID(), "USER"),
                    "token",
                    request(DiscoveryCategory.CAFE, preview.seedId())))
        .isInstanceOf(SectionFeedCache.SeedNotFoundException.class);
  }

  @Test
  void missingSeedIsSafeDirectEntryAndStayGetsBroadPool() {
    var response = recommend(user, "token", request(DiscoveryCategory.STAY, UUID.randomUUID()));
    assertThat(response.seedReused()).isFalse();
    verify(place).generateCategories(any(), eq(List.of(DiscoveryCategory.STAY)), eq(50));
    verify(semantic).generate(any());
  }

  @Test
  void failedSemanticDoesNotEraseLocalAndIsNotReusableAsSuccess() {
    when(semantic.generate(any())).thenThrow(new IllegalStateException("unavailable"));
    var preview = recommend(user, "token", request(null, null));
    assertThat(preview.returnedCount()).isEqualTo(16);
    assertThat(preview.sections()).allMatch(s -> s.degradations().contains("SEMANTIC_UNAVAILABLE"));
    recommend(user, "token", request(DiscoveryCategory.CAFE, preview.seedId()));
    verify(semantic, times(2)).generate(any());
  }

  @Test
  void completeSourceFailureDoesNotMasqueradeAsEmpty() {
    when(semantic.generate(any())).thenThrow(new IllegalStateException());
    when(place.generateCategories(any(), anyList(), anyInt()))
        .thenThrow(new IllegalStateException());
    assertThatThrownBy(() -> recommend(user, "token", request(null, null)))
        .isInstanceOf(CandidateRetrievalUnavailableException.class);
    verifyNoInteractions(recorder);
  }

  @Test
  void explicitPrimaryIsConsistentAcrossPreviewAndSelectedCategoryEvenWithMisleadingTags() {
    var base = inventory.get(DiscoveryCategory.FOOD).getFirst();
    var p = base.place();
    var typed =
        new PlaceSnapshot(
            p.id(),
            p.provider(),
            p.providerPlaceId(),
            p.name(),
            p.location(),
            p.address(),
            p.city(),
            p.district(),
            List.of("restaurant", "food", "tourist_attraction"),
            p.rating(),
            p.userRatingCount(),
            p.quietnessEvidence(),
            p.photos(),
            p.openingHours(),
            p.businessStatus(),
            p.description(),
            p.fetchedAt(),
            p.freshness(),
            "coffee_shop");
    var mixed = new ArrayList<>(inventory.get(DiscoveryCategory.FOOD));
    mixed.set(
        0,
        new Candidate(
            base.placeId(),
            base.source(),
            base.sourceRank(),
            base.sourceScore(),
            typed,
            base.retrievalEvidence()));
    inventory.put(DiscoveryCategory.FOOD, mixed);
    var preview = recommend(user, "token", request(null, null));
    assertThat(
            preview.sections().stream()
                .filter(
                    s ->
                        s.category() == DiscoveryCategory.FOOD
                            || s.category() == DiscoveryCategory.ATTRACTION)
                .flatMap(s -> s.items().stream()))
        .noneMatch(i -> i.place().id().equals(p.id()));
    var food = recommend(user, "token", request(DiscoveryCategory.FOOD, null));
    assertThat(food.sections().getFirst().items()).noneMatch(i -> i.place().id().equals(p.id()));
    var cafes = new ArrayList<>(inventory.get(DiscoveryCategory.CAFE));
    cafes.add(mixed.getFirst());
    inventory.put(DiscoveryCategory.CAFE, cafes);
    var cafe = recommend(user, "token", request(DiscoveryCategory.CAFE, null));
    assertThat(cafe.sections().getFirst().items()).anyMatch(i -> i.place().id().equals(p.id()));
  }

  @Test
  void partialPlaceBatchPreservesOtherThreeSectionsWithoutProviderOrExtraCalls() {
    when(place.generateCategories(any(), anyList(), anyInt()))
        .thenReturn(
            new CategoryCandidateSource.Batch(
                DiscoveryCategory.preview().stream()
                    .map(
                        c ->
                            c == DiscoveryCategory.ATTRACTION
                                ? new CategoryCandidateSource.Group(
                                    c, "ERROR", List.of(), List.of("LOCAL_CATEGORY_TIMEOUT"))
                                : new CategoryCandidateSource.Group(
                                    c, "READY", inventory.get(c), List.of()))
                    .toList()));
    var response = recommend(user, "token", request(null, null));
    assertThat(response.returnedCount()).isEqualTo(12);
    assertThat(response.sections().getFirst().status()).isEqualTo("ERROR");
    assertThat(response.sections().subList(1, 4))
        .allMatch(s -> s.status().equals("READY") && s.items().size() == 4);
    verify(place, times(1)).generateCategories(any(), eq(DiscoveryCategory.preview()), eq(12));
    verify(semantic, times(1)).generate(any());
    verify(recorder, times(1)).record(any(), any());
  }

  @Test
  void timeoutKeepsCompletedLocalAndCancelsSource() throws Exception {
    settings.setRetrievalTimeout(Duration.ofMillis(80));
    var cancelled = new CountDownLatch(1);
    when(semantic.generate(any()))
        .thenAnswer(
            i -> {
              try {
                new CountDownLatch(1).await();
              } catch (InterruptedException e) {
                cancelled.countDown();
                throw new IllegalStateException();
              }
              return null;
            });
    var response = recommend(user, "token", request(null, null));
    assertThat(response.returnedCount()).isEqualTo(16);
    assertThat(cancelled.await(1, TimeUnit.SECONDS)).isTrue();
  }

  @Test
  void cacheOutageOnlyDisablesSeedNotFeed() {
    doThrow(new IllegalStateException())
        .when(values)
        .set(anyString(), anyString(), any(Duration.class));
    assertThat(recommend(user, "token", request(null, null)).seedId()).isNull();
  }

  @Test
  void enoughEligibleSeedCandidatesAvoidsBothRetrievalSources() {
    inventory.put(DiscoveryCategory.CAFE, candidates(DiscoveryCategory.CAFE, 48));
    var direct = recommend(user, "token", request(DiscoveryCategory.CAFE, null));
    clearInvocations(place, semantic);
    var next = recommend(user, "token", request(DiscoveryCategory.CAFE, direct.seedId()));
    assertThat(next.returnedCount()).isEqualTo(48);
    assertThat(next.seedReused()).isTrue();
    verify(place, never()).generateCategories(any(), anyList(), anyInt());
    verify(semantic, never()).generate(any());
  }
}
