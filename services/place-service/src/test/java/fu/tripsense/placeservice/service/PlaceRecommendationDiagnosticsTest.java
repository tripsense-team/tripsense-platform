package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.LocationDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.dto.PlaceRecommendationRequest;
import fu.tripsense.placeservice.observability.RequestDiagnostics;
import fu.tripsense.placeservice.providers.PlaceProvider;
import fu.tripsense.placeservice.service.impl.PlaceRankingServiceImpl;
import fu.tripsense.placeservice.service.impl.PlaceSearchServiceImpl;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class PlaceRecommendationDiagnosticsTest {
  @Mock private PlaceRepository repository;
  @Mock private PlaceProvider provider;
  @Mock private PlaceCacheService cache;
  @Mock private PlacePersistenceService persistence;
  private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
  private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
  private final Logger logger = (Logger) LoggerFactory.getLogger(RequestDiagnostics.class);
  private PlaceSearchService service;

  @BeforeEach
  void start() {
    logs.start();
    logger.addAppender(logs);
    RequestDiagnostics.begin("place-service", "place-diagnostics-test", registry);
    service =
        new PlaceSearchServiceImpl(
            repository,
            provider,
            cache,
            new PlaceRankingServiceImpl(),
            persistence,
            new TripSensePlaceProperties());
    when(cache.getSearchResults(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt()))
        .thenReturn(Optional.empty());
  }

  @AfterEach
  void stop() {
    RequestDiagnostics.finish(200);
    logger.detachAppender(logs);
    logs.stop();
    registry.close();
  }

  @Test
  void exposes49Of50DecisionAndSeparatesDatabaseFromMapping() {
    var entities =
        IntStream.range(0, 50).mapToObj(i -> Place.builder().id("p" + i).build()).toList();
    when(repository.searchByText(anyString(), any(Pageable.class))).thenReturn(entities);
    when(persistence.toDto(any()))
        .thenAnswer(
            call -> {
              Place entity = call.getArgument(0);
              var dto = dto(entity.getId());
              if ("p49".equals(entity.getId())) dto.setLocation(new LocationDto(0, 0));
              return dto;
            });
    when(provider.getProviderName()).thenReturn("ziomap");
    when(provider.textSearch(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt()))
        .thenReturn(List.of());

    var result = service.recommend(request(50, true, List.of("id", "location", "categories")));

    assertThat(result.candidates()).hasSize(49);
    state("place_mongo_candidates", "50");
    state("place_local_removed_after_ranking_geo", "1");
    state("place_target_count", "50");
    state("place_local_candidate_count", "49");
    state("place_local_eligible_count", "49");
    state("place_local_reason_codes", "TOO_FEW_CANDIDATES");
    state("place_refresh_decision", "REFRESH_PROVIDER");
    for (String phase :
        List.of(
            "mongo_search",
            "mongo_fetch",
            "mongo_text_query",
            "mongo_dto_mapping",
            "local_assessment")) phase(phase, "success", 1);
    verify(provider).textSearch(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt());
  }

  @Test
  void sufficientLocalEvidencePreservesNoProviderPath() {
    local(dto("p1"));
    service.recommend(request(1, true, List.of("id", "location", "categories")));
    state("place_local_status", "SUFFICIENT");
    state("place_local_reason_codes", "NONE");
    state("place_refresh_decision", "USE_LOCAL");
    verify(provider, never()).textSearch(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt());
  }

  @ParameterizedTest
  @ValueSource(ints = {0, 1, 40, 49})
  void refreshDisabledReturnsAvailableLocalCountWithoutProvider(int count) {
    var entities =
        IntStream.range(0, count).mapToObj(i -> Place.builder().id("p" + i).build()).toList();
    when(repository.searchByText(anyString(), any(Pageable.class))).thenReturn(entities);
    if (count > 0)
      when(persistence.toDto(any())).thenAnswer(call -> dto(((Place) call.getArgument(0)).getId()));

    var result = service.recommend(request(50, false, List.of("id", "location", "categories")));

    assertThat(result.candidates()).hasSize(count);
    assertThat(result.evidence().status()).isEqualTo("INSUFFICIENT");
    assertThat(result.evidence().reasonCodes()).contains("TOO_FEW_CANDIDATES");
    assertThat(result.evidence().refreshPerformed()).isFalse();
    state("place_refresh_decision", "REFRESH_DISABLED");
    verify(provider, never()).textSearch(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt());
    verify(persistence, never()).upsertProviderPlace(any(), anyString());
  }

  @Test
  void completeCachedSearchDoesNotForceProviderEvenWhenRefreshEnabled() {
    when(cache.getSearchResults(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt()))
        .thenReturn(Optional.of(List.of(dto("cached"))));
    var result = service.recommend(request(1, true, List.of("id", "location", "categories")));
    assertThat(result.candidates()).hasSize(1);
    assertThat(result.evidence().status()).isEqualTo("SUFFICIENT");
    state("place_refresh_decision", "USE_CACHE");
    verify(repository, never()).searchByText(anyString(), any(Pageable.class));
    verify(provider, never()).textSearch(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt());
  }

  @Test
  void incompleteCacheWithRefreshDisabledStillNeverCallsProvider() {
    when(cache.getSearchResults(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt()))
        .thenReturn(Optional.of(List.of(dto("cached"))));
    local(dto("stored"));

    var result = service.recommend(request(50, false, List.of("id", "location", "categories")));

    assertThat(result.candidates()).extracting(PlaceDto::getId).containsExactly("stored");
    assertThat(result.evidence().status()).isEqualTo("INSUFFICIENT");
    assertThat(result.evidence().refreshPerformed()).isFalse();
    state("place_cache_status", "INSUFFICIENT");
    state("place_refresh_decision", "REFRESH_DISABLED");
    verify(provider, never()).textSearch(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt());
  }

  @Test
  void missingMandatoryFieldExplainsIneligibility() {
    var dto = dto("p1");
    dto.setCategories(List.of());
    local(dto);
    service.recommend(request(1, false, List.of("id", "location", "categories")));
    state("place_local_eligible_count", "0");
    state("place_local_coverage_categories", "0.0");
    state("place_local_reason_codes", "MANDATORY_FIELD_MISSING:categories");
    state("place_refresh_decision", "REFRESH_DISABLED");
  }

  @Test
  void staleEvidenceExplainsRefreshWithoutChangingEligibility() {
    var dto = dto("p1");
    dto.setFetchedAt(Instant.now().minus(Duration.ofDays(31)));
    local(dto);
    service.recommend(request(1, false, List.of("id")));
    state("place_local_freshness", "STALE");
    state("place_local_eligible_count", "1");
    state("place_local_reason_codes", "STALE_REQUIRED_EVIDENCE");
  }

  @Test
  void regexFallbackAndCooldownHaveTheirOwnQueryTimings() {
    when(repository.searchByText(anyString(), any(Pageable.class)))
        .thenThrow(new IllegalStateException("private database detail"));
    when(repository.findByNameRegex(anyString(), any(Pageable.class))).thenReturn(List.of());
    var request = request(1, false, List.of());
    service.recommend(request);
    service.recommend(request);
    state("place_search_method", "REGEX_AFTER_TEXT_FAILURE");
    state("place_search_method", "REGEX_COOLDOWN");
    phase("mongo_text_query", "error", 1);
    phase("mongo_regex_query", "success", 2);
    verify(repository, times(1)).searchByText(anyString(), any(Pageable.class));
    verify(repository, times(2)).findByNameRegex(anyString(), any(Pageable.class));
  }

  @Test
  void arbitraryRequiredFieldNamesDoNotLeakIntoDiagnosticLogs() {
    local(dto("p1"));
    service.recommend(request(1, false, List.of("private-field\nprivate-token")));
    state("place_local_reason_codes", "MANDATORY_FIELD_MISSING:UNSUPPORTED_FIELD");
    assertThat(messages())
        .noneMatch(
            message ->
                message.contains("private-field")
                    || message.contains("private-token")
                    || message.contains("private-query"));
  }

  private void local(PlaceDto dto) {
    Place entity = Place.builder().id(dto.getId()).build();
    when(repository.searchByText(anyString(), any(Pageable.class))).thenReturn(List.of(entity));
    when(persistence.toDto(entity)).thenReturn(dto);
  }

  private PlaceDto dto(String id) {
    return PlaceDto.builder()
        .id(id)
        .name("private-query")
        .categories(List.of("cafe"))
        .location(new LocationDto(16.0544, 108.2022))
        .fetchedAt(Instant.now())
        .build();
  }

  private PlaceRecommendationRequest request(int target, boolean refresh, List<String> fields) {
    return new PlaceRecommendationRequest(
        "private-query",
        16.0544,
        108.2022,
        12_000,
        target,
        fields,
        Duration.ofDays(30).toSeconds(),
        refresh);
  }

  private List<String> messages() {
    return logs.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
  }

  private void state(String name, String value) {
    assertThat(messages())
        .anyMatch(message -> message.contains("name=" + name + " value=" + value));
  }

  private void phase(String name, String outcome, int count) {
    assertThat(
            registry
                .get("tripsense.explore.phase")
                .tags("phase", name, "outcome", outcome)
                .timer()
                .count())
        .isEqualTo(count);
  }
}
