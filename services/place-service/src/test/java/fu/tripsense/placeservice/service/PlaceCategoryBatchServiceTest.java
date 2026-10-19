package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.dto.*;
import jakarta.validation.Validation;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

class PlaceCategoryBatchServiceTest {
  private final MongoTemplate mongo = mock(MongoTemplate.class);
  private final PlacePersistenceService mapping = mock(PlacePersistenceService.class);
  private final PlaceCacheService cache = mock(PlaceCacheService.class);
  private final ThreadPoolExecutor executor =
      new fu.tripsense.placeservice.config.CategoryRetrievalConfig().categoryRetrievalExecutor();
  private final ThreadPoolExecutor reads =
      new fu.tripsense.placeservice.config.CategoryRetrievalConfig().categoryCacheReadExecutor();
  private final ThreadPoolExecutor writes =
      new fu.tripsense.placeservice.config.CategoryRetrievalConfig().categoryCacheWriteExecutor();
  private final PlaceCategoryBatchService service =
      new PlaceCategoryBatchService(
          mongo,
          mapping,
          new CategoryCacheAccess(cache, reads, writes, Duration.ofMillis(100)),
          executor);

  @AfterEach
  void shutdown() throws InterruptedException {
    executor.shutdownNow();
    reads.shutdownNow();
    writes.shutdownNow();
    assertThat(executor.awaitTermination(2, TimeUnit.SECONDS)).isTrue();
    assertThat(reads.awaitTermination(2, TimeUnit.SECONDS)).isTrue();
    assertThat(writes.awaitTermination(2, TimeUnit.SECONDS)).isTrue();
  }

  private PlaceCategoryBatchRequest request(List<DiscoveryCategory> categories, int limit) {
    return new PlaceCategoryBatchRequest(
        16.0544, 108.2022, 35000, categories, limit, 2592000L, List.of(), false);
  }

  @Test
  void categoryAndGeoAreMongoPredicatesBeforeSmallLimit() {
    var q =
        PlaceCategoryBatchService.query(
            request(List.of(DiscoveryCategory.CAFE), 12), DiscoveryCategory.CAFE);
    assertThat(q.getLimit()).isEqualTo(48);
    assertThat(q.getQueryObject().toString())
        .contains("location", "categories")
        .doesNotContain("description", "$text");
    assertThat(q.getMeta().getMaxTimeMsec()).isEqualTo(400L);
  }

  @Test
  void hotelHeavyInventoryCannotConsumeCafeLimit() {
    var inventory = new ArrayList<Place>();
    for (int i = 0; i < 1500; i++)
      inventory.add(Place.builder().id("hotel-" + i).categories(List.of("hotel")).build());
    for (int i = 0; i < 8; i++)
      inventory.add(Place.builder().id("cafe-" + i).categories(List.of("cafe")).build());
    when(mongo.find(any(Query.class), eq(Place.class)))
        .thenAnswer(
            inv -> {
              Query query = inv.getArgument(0);
              assertThat(query.getQueryObject().toString()).contains("categories");
              return inventory.stream()
                  .filter(p -> DiscoveryCategory.CAFE.matches(p.getCategories(), p.getName()))
                  .limit(query.getLimit())
                  .toList();
            });
    when(mapping.toDto(any()))
        .thenAnswer(
            inv -> {
              Place p = inv.getArgument(0);
              return PlaceDto.builder()
                  .id(p.getId())
                  .categories(p.getCategories())
                  .location(new LocationDto(16.0544, 108.2022))
                  .build();
            });
    var result = service.retrieve(request(List.of(DiscoveryCategory.CAFE), 4));
    assertThat(result.groups().getFirst().places())
        .hasSize(4)
        .allMatch(p -> p.getId().startsWith("cafe-"));
    verify(mongo, times(1)).find(any(Query.class), eq(Place.class));
  }

  @Test
  void failuresAreIsolatedFromTrueEmptyGroups() {
    when(mongo.find(any(Query.class), eq(Place.class)))
        .thenAnswer(
            i -> {
              if (i.<Query>getArgument(0).getQueryObject().toString().contains("home"))
                throw new IllegalStateException("private database detail");
              return List.of();
            });
    var result =
        service.retrieve(request(List.of(DiscoveryCategory.HOMESTAY, DiscoveryCategory.CAFE), 12));
    assertThat(result.groups())
        .extracting(PlaceCategoryBatchService.Group::status)
        .containsExactly("ERROR", "EMPTY");
    assertThat(result.toString()).doesNotContain("private database detail");
  }

  @Test
  void cachedWrongCategoryAndOutOfAreaAreNotReturned() {
    var hotel =
        PlaceDto.builder()
            .id("hotel")
            .name("Seaside Hotel")
            .description("Near a homestay")
            .categories(List.of("hotel"))
            .location(new LocationDto(16.0544, 108.2022))
            .build();
    var far =
        PlaceDto.builder()
            .id("far")
            .categories(List.of("homestay"))
            .location(new LocationDto(10, 100))
            .build();
    when(cache.getSearchResults(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt()))
        .thenReturn(Optional.of(List.of(hotel, far)));
    assertThat(
            service
                .retrieve(request(List.of(DiscoveryCategory.HOMESTAY), 12))
                .groups()
                .getFirst()
                .places())
        .isEmpty();
    verify(mongo).find(any(Query.class), eq(Place.class));
  }

  @Test
  void rejectsProviderDuplicateCategoriesAndUnboundedLimit() {
    try (var factory = Validation.buildDefaultValidatorFactory()) {
      var validator = factory.getValidator();
      assertThat(validator.validate(request(List.of(DiscoveryCategory.CAFE), 12))).isEmpty();
      assertThat(
              validator.validate(
                  request(List.of(DiscoveryCategory.CAFE, DiscoveryCategory.CAFE), 12)))
          .isNotEmpty();
      assertThat(validator.validate(request(List.of(DiscoveryCategory.CAFE), 51))).isNotEmpty();
      var r = request(List.of(DiscoveryCategory.CAFE), 12);
      assertThat(
              validator.validate(
                  new PlaceCategoryBatchRequest(
                      r.lat(),
                      r.lng(),
                      r.radiusMeters(),
                      r.categories(),
                      12,
                      r.maximumAgeSeconds(),
                      r.requiredFields(),
                      true)))
          .isNotEmpty();
    }
  }

  @Test
  void strictTaxonomyDoesNotUseIncidentalDescriptionsOrSubstrings() {
    assertThat(DiscoveryCategory.HOMESTAY.matches(List.of("hotel"), "Seaside Hotel")).isFalse();
    assertThat(DiscoveryCategory.HOMESTAY.matches(List.of("lodging"), "An Home Stay Đà Nẵng"))
        .isTrue();
    assertThat(DiscoveryCategory.HOMESTAY.matches(List.of("homestay"), "An")).isTrue();
    assertThat(DiscoveryCategory.CAFE.matches(List.of("cafeteria_equipment"), "Coffee supplies"))
        .isFalse();
    assertThat(DiscoveryCategory.ATTRACTION.matches(List.of("beach"), "Beach")).isTrue();
  }

  @Test
  void slowFirstCategoryCannotDiscardOtherCompletedGroups() throws Exception {
    CountDownLatch started = new CountDownLatch(1), cancelled = new CountDownLatch(1);
    when(cache.getSearchResults(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt()))
        .thenAnswer(
            i -> {
              if (i.<String>getArgument(0).contains("ATTRACTION")) {
                return Optional.empty();
              }
              return Optional.of(
                  List.of(
                      PlaceDto.builder()
                          .id(i.getArgument(0))
                          .name(
                              i.<String>getArgument(0).contains("HOMESTAY")
                                  ? "An Homestay"
                                  : "Sample")
                          .categories(
                              List.of(
                                  i.<String>getArgument(0).contains("CAFE")
                                      ? "cafe"
                                      : i.<String>getArgument(0).contains("HOMESTAY")
                                          ? "homestay"
                                          : "restaurant"))
                          .location(new LocationDto(16.0544, 108.2022))
                          .build()));
            });
    when(mongo.find(any(Query.class), eq(Place.class)))
        .thenAnswer(
            i -> {
              started.countDown();
              try {
                new CountDownLatch(1).await();
              } catch (InterruptedException e) {
                cancelled.countDown();
                Thread.currentThread().interrupt();
                throw new IllegalStateException();
              }
              return List.of();
            });
    var result = service.retrieve(request(DiscoveryCategory.preview(), 12), Duration.ofMillis(400));
    assertThat(started.getCount()).isZero();
    assertThat(result.groups())
        .extracting(PlaceCategoryBatchService.Group::status)
        .containsExactly("ERROR", "READY", "READY", "READY");
    assertThat(result.groups().getFirst().degradations()).containsExactly("LOCAL_CATEGORY_TIMEOUT");
    assertThat(cancelled.await(1, TimeUnit.SECONDS)).isTrue();
  }

  @Test
  void saturatedExecutorReturnsSafeErrorsWithoutCallerRunsOrMongoQueries() {
    executor.shutdownNow();
    var result = service.retrieve(request(DiscoveryCategory.preview(), 12));
    assertThat(result.groups())
        .allMatch(
            g ->
                g.status().equals("ERROR")
                    && g.degradations().contains("LOCAL_CATEGORY_OVERLOADED"));
    verifyNoInteractions(mongo, cache);
  }
}
