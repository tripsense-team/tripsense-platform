package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import fu.tripsense.placeservice.config.CategoryRetrievalConfig;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.dto.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

class CategoryCacheResilienceTest {
  private final CategoryRetrievalConfig config = new CategoryRetrievalConfig();
  private final ThreadPoolExecutor reads = config.categoryCacheReadExecutor(),
      writes = config.categoryCacheWriteExecutor(),
      groups = config.categoryRetrievalExecutor();
  private final PlaceCacheService cache = mock(PlaceCacheService.class);
  private final MongoTemplate mongo = mock(MongoTemplate.class);
  private final PlacePersistenceService mapping = mock(PlacePersistenceService.class);
  private final CategoryCacheAccess access =
      new CategoryCacheAccess(cache, reads, writes, Duration.ofMillis(50));
  private final PlaceCategoryBatchService service =
      new PlaceCategoryBatchService(mongo, mapping, access, groups);
  private final CountDownLatch release = new CountDownLatch(1);

  @BeforeEach
  void inventory() {
    List<Place> data = new ArrayList<>();
    for (String code : List.of("museum", "homestay", "restaurant", "cafe"))
      for (int i = 0; i < 4; i++)
        data.add(Place.builder().id(code + i).categories(List.of(code)).primaryType(code).build());
    when(mongo.find(any(Query.class), eq(Place.class))).thenReturn(data);
    when(mapping.toDto(any()))
        .thenAnswer(
            i -> {
              Place p = i.getArgument(0);
              return PlaceDto.builder()
                  .id(p.getId())
                  .categories(p.getCategories())
                  .primaryType(p.getPrimaryType())
                  .location(new LocationDto(16.0544, 108.2022))
                  .build();
            });
  }

  @AfterEach
  void stop() throws Exception {
    release.countDown();
    for (var pool : List.of(groups, reads, writes)) pool.shutdownNow();
    for (var pool : List.of(groups, reads, writes))
      assertThat(pool.awaitTermination(2, TimeUnit.SECONDS)).isTrue();
  }

  private PlaceCategoryBatchRequest request() {
    return new PlaceCategoryBatchRequest(
        16.0544, 108.2022, 35000, DiscoveryCategory.preview(), 12, 2592000L, List.of(), false);
  }

  @Test
  void hangingCacheReadsDoNotConsumeDatabaseBudgetOrLoseAnyCategory() throws Exception {
    CountDownLatch started = new CountDownLatch(4);
    when(cache.getSearchResults(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt()))
        .thenAnswer(
            i -> {
              started.countDown();
              release.await();
              return Optional.empty();
            });
    var result = service.retrieve(request(), Duration.ofMillis(600));
    assertThat(result.groups())
        .hasSize(4)
        .allMatch(g -> g.status().equals("READY") && g.places().size() == 4);
    assertThat(started.await(1, TimeUnit.SECONDS)).isTrue();
    verify(mongo, times(4)).find(any(Query.class), eq(Place.class));
  }

  @Test
  void hangingCacheWritesNeverHoldBackReadyCanonicalGroups() throws Exception {
    CountDownLatch started = new CountDownLatch(1);
    doAnswer(
            i -> {
              started.countDown();
              release.await();
              return null;
            })
        .when(cache)
        .putSearchResults(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt(), anyList());
    var result = service.retrieve(request(), Duration.ofMillis(600));
    assertThat(result.groups()).allMatch(g -> g.status().equals("READY") && g.places().size() == 4);
    assertThat(started.await(1, TimeUnit.SECONDS)).isTrue();
    assertThat(release.getCount()).isEqualTo(1);
  }

  @Test
  void saturatedOrStoppedCacheExecutorsAreCacheBypassesNotDatabaseFailures() {
    reads.shutdownNow();
    writes.shutdownNow();
    var result = service.retrieve(request(), Duration.ofMillis(600));
    assertThat(result.groups()).allMatch(g -> g.status().equals("READY") && g.places().size() == 4);
    verifyNoInteractions(cache);
  }

  @Test
  void successfulCacheReadStillAvoidsMongo() {
    var p =
        PlaceDto.builder()
            .id("cached-cafe")
            .categories(List.of("cafe"))
            .location(new LocationDto(16.0544, 108.2022))
            .build();
    when(cache.getSearchResults(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt()))
        .thenReturn(Optional.of(List.of(p)));
    var r = request();
    var result =
        service.retrieve(
            new PlaceCategoryBatchRequest(
                r.lat(),
                r.lng(),
                r.radiusMeters(),
                List.of(DiscoveryCategory.CAFE),
                12,
                r.maximumAgeSeconds(),
                List.of(),
                false));
    assertThat(result.groups().getFirst().places())
        .extracting(PlaceDto::getId)
        .containsExactly("cached-cafe");
    verifyNoInteractions(mongo);
  }
}
