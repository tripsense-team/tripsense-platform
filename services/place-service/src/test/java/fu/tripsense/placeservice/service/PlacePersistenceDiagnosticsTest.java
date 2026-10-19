package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.LocationDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.observability.RequestDiagnostics;
import fu.tripsense.placeservice.service.impl.PlacePersistenceServiceImpl;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;

class PlacePersistenceDiagnosticsTest {
  private final PlaceRepository repository = mock(PlaceRepository.class);
  private final PlacePersistenceServiceImpl service =
      new PlacePersistenceServiceImpl(repository, new TripSensePlaceProperties());
  private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
  private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
  private final Logger diagnostics = (Logger) LoggerFactory.getLogger(RequestDiagnostics.class);
  private final Logger persistence =
      (Logger) LoggerFactory.getLogger(PlacePersistenceServiceImpl.class);

  @BeforeEach
  void start() {
    logs.start();
    diagnostics.addAppender(logs);
    persistence.addAppender(logs);
    RequestDiagnostics.begin("place-service", "persistence-test", registry);
  }

  @AfterEach
  void stop() {
    RequestDiagnostics.finish(200);
    diagnostics.detachAppender(logs);
    persistence.detachAppender(logs);
    logs.stop();
    registry.close();
  }

  private PlaceDto dto() {
    return PlaceDto.builder()
        .providerPlaceId("private-provider-id")
        .name("private-name")
        .address("private-address")
        .location(new LocationDto(16.0544, 108.2022))
        .categories(List.of("cafe"))
        .rating(4.5)
        .build();
  }

  private Place existing(String id) {
    return Place.builder()
        .id(id)
        .provider("other-provider")
        .providerPlaceId("other-id")
        .name("private-name")
        .normalizedName("private-name")
        .address("private-address")
        .location(new GeoJsonPoint(108.2022, 16.0544))
        .build();
  }

  private void save() {
    when(repository.save(any()))
        .thenAnswer(
            call -> {
              Place entity = call.getArgument(0);
              if (entity.getId() == null) entity.setId("canonical-private-id");
              return entity;
            });
  }

  private void state(String name, String value) {
    assertThat(logs.list)
        .anyMatch(
            event -> event.getFormattedMessage().contains("name=" + name + " value=" + value));
  }

  private void phase(String name, String outcome) {
    assertThat(
            registry
                .get("tripsense.explore.phase")
                .tags("phase", name, "outcome", outcome)
                .timer()
                .count())
        .isEqualTo(1);
  }

  @Test
  void newPlaceTimesLookupDuplicateCheckPrepareSaveAndMappingInOrder() {
    save();
    var result = service.upsertProviderPlace(dto(), "ziomap");
    assertThat(result.getId()).isEqualTo("canonical-private-id");
    assertThat(result.getProvider()).isEqualTo("ziomap");
    assertThat(result.getCategories()).containsExactly("cafe");
    assertThat(result.getRating()).isEqualTo(4.5);
    var order = inOrder(repository);
    order.verify(repository).findByProviderAndProviderPlaceId("ziomap", "private-provider-id");
    order.verify(repository).findByNormalizedName("private-name");
    order.verify(repository).save(any());
    order.verifyNoMoreInteractions();
    for (String name :
        List.of(
            "provider_lookup",
            "duplicate_lookup",
            "duplicate_filter",
            "new_entity",
            "apply",
            "save_new",
            "to_dto",
            "total")) phase("place_upsert_" + name, "success");
    state("place_upsert_result", "NEW_SAVED");
    state("place_upsert_lookup_hit", "false");
    assertThat(logs.list).noneMatch(event -> event.getFormattedMessage().contains("private-"));
  }

  @Test
  void existingProviderPlaceIsStillUpdatedNotSkipped() {
    var entity = existing("canonical-private-id");
    when(repository.findByProviderAndProviderPlaceId("custom", "private-provider-id"))
        .thenReturn(Optional.of(entity));
    save();
    var incoming = dto();
    incoming.setProvider("custom");
    var result = service.upsertProviderPlace(incoming, "ziomap");
    assertThat(result.getId()).isEqualTo(entity.getId());
    assertThat(entity.getRating()).isEqualTo(4.5);
    assertThat(entity.getLastFetchedAt()).isNotNull();
    verify(repository, never()).findByNormalizedName(any());
    verify(repository).save(same(entity));
    phase("place_upsert_save_existing", "success");
    state("place_upsert_result", "EXISTING_SAVED");
  }

  @Test
  void unambiguousCrossProviderDuplicateIsReusedWithoutSave() {
    when(repository.findByNormalizedName("private-name"))
        .thenReturn(List.of(existing("canonical-private-id")));
    assertThat(service.upsertProviderPlace(dto(), "ziomap").getId())
        .isEqualTo("canonical-private-id");
    verify(repository, never()).save(any());
    state("place_upsert_duplicate_matches", "1");
    state("place_upsert_result", "DUPLICATE_REUSED");
    phase("place_upsert_to_dto", "success");
  }

  @Test
  void ambiguousDuplicatesKeepOriginalNewPlaceBehavior() {
    when(repository.findByNormalizedName("private-name"))
        .thenReturn(List.of(existing("first"), existing("second")));
    save();
    service.upsertProviderPlace(dto(), "ziomap");
    state("place_upsert_duplicate_matches", "2");
    state("place_upsert_result", "NEW_SAVED");
    verify(repository).save(any());
  }

  @Test
  void missingDuplicatePrerequisitesDoNotIntroduceExtraLookup() {
    save();
    var incoming = dto();
    incoming.setAddress(null);
    service.upsertProviderPlace(incoming, "ziomap");
    verify(repository, never()).findByNormalizedName(any());
    state("place_upsert_duplicate_check_skipped", "true");
    state("place_upsert_result", "NEW_SAVED");
  }

  @ParameterizedTest
  @ValueSource(strings = {"lookup", "duplicate", "save", "mapping"})
  void caughtFailureIsVisibleAndCooldownPreservesFallback(String stage) {
    var failure = new IllegalStateException("private-name private-token private-provider-id");
    PlacePersistenceServiceImpl target = service;
    String errorPhase;
    switch (stage) {
      case "lookup" -> {
        when(repository.findByProviderAndProviderPlaceId(any(), any())).thenThrow(failure);
        errorPhase = "provider_lookup";
      }
      case "duplicate" -> {
        when(repository.findByNormalizedName(any())).thenThrow(failure);
        errorPhase = "duplicate_lookup";
      }
      case "save" -> {
        when(repository.save(any())).thenThrow(failure);
        errorPhase = "save_new";
      }
      default -> {
        save();
        target = spy(service);
        doThrow(failure).when(target).toDto(any());
        errorPhase = "to_dto";
      }
    }
    var incoming = dto();
    assertThat(target.upsertProviderPlace(incoming, "ziomap")).isSameAs(incoming);
    assertThat(incoming.getId()).isEqualTo(incoming.getProviderPlaceId());
    state("place_upsert_result", "FAILED_FALLBACK");
    phase("place_upsert_" + errorPhase, "error");
    phase("place_upsert_total", "success"); // Existing catch deliberately returns fallback.
    var next = dto();
    next.setId("preserved-id");
    clearInvocations(repository);
    assertThat(target.upsertProviderPlace(next, "ziomap")).isSameAs(next);
    assertThat(next.getId()).isEqualTo("preserved-id");
    verifyNoInteractions(repository);
    state("place_upsert_result", "COOLDOWN_BYPASS");
    assertThat(logs.list).noneMatch(event -> event.getFormattedMessage().contains("private-"));
  }

  @Test
  void invalidInputStillThrowsBeforeAnyDatabaseOperation() {
    assertThatThrownBy(() -> service.upsertProviderPlace(null, "ziomap"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.upsertProviderPlace(PlaceDto.builder().build(), "ziomap"))
        .isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(repository);
    state("place_upsert_result", "INVALID_INPUT");
    assertThat(
            registry
                .get("tripsense.explore.phase")
                .tags("phase", "place_upsert_total", "outcome", "error")
                .timer()
                .count())
        .isEqualTo(2);
  }

  @Test
  void diagnosticsDisabledKeepsSamePersistenceWithNoEventsOrMetrics() {
    RequestDiagnostics.finish(200);
    int eventCount = logs.list.size();
    int meters = registry.getMeters().size();
    save();
    assertThat(service.upsertProviderPlace(dto(), "ziomap").getId())
        .isEqualTo("canonical-private-id");
    verify(repository).save(any());
    assertThat(logs.list).hasSize(eventCount);
    assertThat(registry.getMeters()).hasSize(meters);
  }
}
