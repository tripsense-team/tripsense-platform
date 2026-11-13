package fu.tripsense.placeservice.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import fu.tripsense.placeservice.client.RecommendationIndexerClient;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceLifecycleStatus;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.BatchEnrichmentProgressDto;
import fu.tripsense.placeservice.dto.BatchEnrichmentRequest;
import fu.tripsense.placeservice.dto.DiscoveryCategory;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.providers.ziomap.ZioMapProvider;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

class PlaceBatchEnrichmentPhase3Test {

  @Test
  void administrativeNormalizerPreservesValidDistrictsAndStripsPrefixes() {
    assertEquals(
        "Hải Châu",
        VietnameseAdministrativeAreaNormalizer.district(null, "123 Lê Duẩn, Q. Hải Châu, Đà Nẵng 550000"));
    assertEquals(
        "Hải Châu",
        VietnameseAdministrativeAreaNormalizer.district("Hai Chau", null)
            .equals("Hai Chau")
            ? VietnameseAdministrativeAreaNormalizer.district("Hải Châu District", null)
            : null);
    assertEquals(
        "Hòa Vang",
        VietnameseAdministrativeAreaNormalizer.district("Huyện Hòa Vang", null));
    assertEquals(
        "Đà Nẵng",
        VietnameseAdministrativeAreaNormalizer.city("Da Nang City 550000", null));
  }

  @Test
  void derivePrimaryTypeSkipsGenericTagsAndMapsVietnameseCategories() {
    assertEquals(
        "restaurant",
        DiscoveryCategory.derivePrimaryTypeFromCategories(
            List.of("establishment", "point_of_interest", "food", "restaurant"), "Bếp Quê"));
    assertEquals(
        "cafe",
        DiscoveryCategory.derivePrimaryTypeFromCategories(
            List.of("point_of_interest", "quán cafe", "đồ uống"), "Cà Phê Sáng"));
    assertEquals(
        "tourist_attraction",
        DiscoveryCategory.derivePrimaryTypeFromCategories(
            List.of("địa điểm khám phá", "point_of_interest"), "Cầu Rồng"));
    assertEquals(
        "homestay",
        DiscoveryCategory.derivePrimaryTypeFromCategories(
            List.of("lodging", "point_of_interest"), "Sunny Home Stay"));
    assertEquals(
        "lodging",
        DiscoveryCategory.derivePrimaryTypeFromCategories(
            List.of("lodging", "point_of_interest", "establishment"), "Khách sạn A"));
    assertNull(
        DiscoveryCategory.derivePrimaryTypeFromCategories(
            List.of("point_of_interest", "establishment"), "Unknown POI"));
  }

  @Test
  void normalizeMetadataAndSyncQdrantRespectsManualOverridesArchivedAndBatches() throws Exception {
    PlaceRepository repository = mock(PlaceRepository.class);
    PlaceDetailsService detailsService = mock(PlaceDetailsService.class);
    ZioMapProvider zioMap = mock(ZioMapProvider.class);
    RecommendationIndexerClient indexerClient = mock(RecommendationIndexerClient.class);
    PlacePersistenceService persistenceService = mock(PlacePersistenceService.class);

    Place dirtyPlace =
        Place.builder()
            .id("p1")
            .name("Cầu Rồng")
            .address("Đường Nguyễn Văn Linh, Q. Hải Châu, Da Nang 550000")
            .city("Da Nang")
            .district(null)
            .categories(List.of("point_of_interest", "tourist_attraction"))
            .primaryType(null)
            .description("Iconic dragon bridge in Da Nang")
            .photos(
                List.of(
                    "https://res.cloudinary.com/demo/image/upload/v1/tripsense/places/p1/a.jpg",
                    "https://lh3.googleusercontent.com/stale-provider-photo"))
            .lifecycleStatus(PlaceLifecycleStatus.ACTIVE)
            .build();

    Place overriddenPlace =
        Place.builder()
            .id("p2")
            .name("Manual Override Place")
            .address("An Thượng, Ngũ Hành Sơn, Đà Nẵng")
            .city("Da Nang")
            .district("")
            .categories(List.of("cafe"))
            .primaryType(null)
            .manualOverrideFields(Set.of("city", "district", "primaryType"))
            .lifecycleStatus(PlaceLifecycleStatus.ACTIVE)
            .build();

    Place archivedPlace =
        Place.builder()
            .id("p3")
            .name("Archived Place")
            .address("Sơn Trà, Đà Nẵng")
            .city("Da Nang")
            .lifecycleStatus(PlaceLifecycleStatus.ARCHIVED)
            .build();

    when(repository.findAll(PageRequest.of(0, 500)))
        .thenReturn(new PageImpl<>(List.of(dirtyPlace, overriddenPlace, archivedPlace)));
    when(repository.save(any(Place.class))).thenAnswer(inv -> inv.getArgument(0));
    when(indexerClient.triggerIndexingBatchSync(any()))
        .thenReturn(new RecommendationIndexerClient.IndexBatchOutcome(2, 1, 0, null));

    PlaceBatchEnrichmentService service =
        new PlaceBatchEnrichmentService(
            repository, detailsService, zioMap, null, indexerClient, persistenceService);

    Map<String, Object> dryRunSummary = service.normalizeMetadataAndSyncQdrant(true, true);
    assertEquals(true, dryRunSummary.get("dryRun"));
    assertEquals(1, dryRunSummary.get("placesUpdated"));
    assertEquals(1, dryRunSummary.get("skippedArchived"));
    assertEquals(3, dryRunSummary.get("skippedManualOverrides"));
    assertEquals("SKIPPED_DRY_RUN", dryRunSummary.get("qdrantStatus"));
    verify(repository, never()).save(any());
    verify(indexerClient, never()).triggerIndexingBatchSync(any());

    Map<String, Object> liveSummary = service.normalizeMetadataAndSyncQdrant(false, true);
    assertEquals(1, liveSummary.get("placesUpdated"));
    assertEquals(1, liveSummary.get("cityNormalized"));
    assertEquals(1, liveSummary.get("districtFilled"));
    assertEquals(1, liveSummary.get("primaryTypeDerived"));
    assertEquals(true, liveSummary.get("qdrantSynced"));
    assertEquals("SYNCED", liveSummary.get("qdrantStatus"));

    assertEquals("Đà Nẵng", dirtyPlace.getCity());
    assertEquals("Hải Châu", dirtyPlace.getDistrict());
    assertEquals("tourist_attraction", dirtyPlace.getPrimaryType());
    assertEquals("Da Nang", overriddenPlace.getCity());
    assertNull(overriddenPlace.getPrimaryType());

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<PlaceDto>> qdrantCaptor = ArgumentCaptor.forClass(List.class);
    verify(indexerClient).triggerIndexingBatchSync(qdrantCaptor.capture());
    assertEquals(2, qdrantCaptor.getValue().size());
    assertFalse(
        qdrantCaptor.getValue().stream().anyMatch(dto -> "p3".equals(dto.getId())),
        "Archived places must not be indexed to Qdrant");
    verifyNoInteractions(persistenceService);
    PlaceDto indexedDirty =
        qdrantCaptor.getValue().stream()
            .filter(dto -> "p1".equals(dto.getId()))
            .findFirst()
            .orElseThrow();
    assertEquals("Iconic dragon bridge in Da Nang", indexedDirty.getDescription());
    assertEquals(
        List.of("https://res.cloudinary.com/demo/image/upload/v1/tripsense/places/p1/a.jpg"),
        indexedDirty.getPhotos());

    // Verify async mode returns SYNC_STARTED immediately and completes in background
    Map<String, Object> asyncSummary = service.normalizeMetadataAndSyncQdrant(false, true, true);
    assertEquals("SYNC_STARTED", asyncSummary.get("qdrantStatus"));
    for (int i = 0; i < 40; i++) {
      if ("COMPLETED".equals(service.getProgress().getStatus())) {
        break;
      }
      TimeUnit.MILLISECONDS.sleep(25);
    }
    assertEquals("COMPLETED", service.getProgress().getStatus());
    assertEquals(2, service.getProgress().getSuccess());
  }

  @Test
  void stalePhotoMigrationTargetsMissingAndGoogleUrlsAndSyncsEmbedding() throws Exception {
    PlaceRepository repository = mock(PlaceRepository.class);
    PlaceDetailsService detailsService = mock(PlaceDetailsService.class);
    ZioMapProvider zioMap = mock(ZioMapProvider.class);
    RecommendationIndexerClient indexerClient = mock(RecommendationIndexerClient.class);

    Place activeMissingPhoto =
        Place.builder()
            .id("p-missing")
            .name("Missing Photo Cafe")
            .lifecycleStatus(PlaceLifecycleStatus.ACTIVE)
            .build();
    Place archivedMissingPhoto =
        Place.builder()
            .id("p-archived")
            .name("Archived Place")
            .lifecycleStatus(PlaceLifecycleStatus.ARCHIVED)
            .build();

    when(repository.findPlacesNeedingCloudinaryPhotos(any(Pageable.class)))
        .thenReturn(List.of(activeMissingPhoto, archivedMissingPhoto));
    when(detailsService.getDetails("p-missing", "Missing Photo Cafe", null, null, true))
        .thenReturn(
            Optional.of(
                PlaceDto.builder()
                    .id("p-missing")
                    .name("Missing Photo Cafe")
                    .photos(List.of("https://res.cloudinary.com/demo/image/upload/v1/cafe.jpg"))
                    .build()));
    when(indexerClient.triggerIndexingBatchSync(any()))
        .thenReturn(new RecommendationIndexerClient.IndexBatchOutcome(1, 1, 0, null));

    PlaceBatchEnrichmentService service =
        new PlaceBatchEnrichmentService(
            repository, detailsService, zioMap, null, indexerClient, null);

    BatchEnrichmentProgressDto started =
        service.startBatchEnrichment(
            BatchEnrichmentRequest.builder().stalePhotosOnly(true).syncEmbedding(true).build());
    assertEquals(1, started.getTotal());

    // Wait briefly for the async single-item batch job to finish
    for (int i = 0; i < 40; i++) {
      if ("COMPLETED".equals(service.getProgress().getStatus())) {
        break;
      }
      TimeUnit.MILLISECONDS.sleep(50);
    }

    assertEquals("COMPLETED", service.getProgress().getStatus());
    assertEquals(1, service.getProgress().getSuccess());
    verify(repository).findPlacesNeedingCloudinaryPhotos(PageRequest.of(0, 2000));
    verify(detailsService, never())
        .getDetails("p-archived", "Archived Place", null, null, true);
    verify(indexerClient, times(1)).triggerIndexingBatchSync(any());
    assertTrue(
        service.getProgress().getRecentLogs().stream()
            .anyMatch(line -> line.contains("Qdrant batch sync finished")));
  }
}

