package fu.tripsense.placeservice.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fu.tripsense.placeservice.client.RecommendationIndexerClient;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceReview;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.dto.PlacePhotoDto;
import fu.tripsense.placeservice.dto.PlaceReviewDto;
import fu.tripsense.placeservice.providers.PlaceEnrichmentProvider;
import fu.tripsense.placeservice.providers.PlaceProvider;
import fu.tripsense.placeservice.providers.PlaceProviderException;
import fu.tripsense.placeservice.service.impl.PlaceDetailsServiceImpl;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PlaceDetailsServiceTest {

  @Mock private PlaceRepository repository;
  @Mock private PlaceProvider provider;
  @Mock private PlaceEnrichmentProvider enrichmentProvider;
  @Mock private PlaceCacheService cache;
  @Mock private PlacePersistenceService persistence;
  @Mock private RecommendationIndexerClient recommendationIndexerClient;

  private PlaceDetailsService service;

  @BeforeEach
  void setUp() {
    service =
        new PlaceDetailsServiceImpl(
            repository,
            provider,
            enrichmentProvider,
            cache,
            persistence,
            recommendationIndexerClient);
  }

  @Test
  void servesFreshCompleteStoredDetailsWithoutProviderCall() {
    Place entity = completeEntity(Instant.now().minus(5, ChronoUnit.DAYS));
    PlaceDto dto = completeDto();
    when(cache.getPlaceDetails("place-1")).thenReturn(Optional.empty());
    when(repository.findById("place-1")).thenReturn(Optional.of(entity));
    when(persistence.toDto(entity)).thenReturn(dto);

    PlaceDto result = service.getDetails("place-1", null, null, null).orElseThrow();

    assertEquals(dto, result);
    verify(enrichmentProvider, never()).enrichPlace(any(), any(), any());
  }

  @Test
  void fetchesAndPersistsPhotosWhenNotYetInPlaceStorage() {
    Place entity = completeEntity(Instant.now());
    PlaceDto dto = completeDto();
    dto.setProvider("ziomap");
    dto.setProviderPlaceId("provider-1");
    when(cache.getPlaceDetails("place-1")).thenReturn(Optional.empty());
    when(repository.findById("place-1")).thenReturn(Optional.of(entity));
    when(persistence.toDto(entity)).thenReturn(dto);
    when(provider.getProviderName()).thenReturn("ziomap");
    when(provider.getPhotoGallery("provider-1", 3))
        .thenReturn(
            List.of(
                new PlacePhotoDto(
                    "https://lh3.googleusercontent.com/photo",
                    "ziomap",
                    List.of(),
                    Instant.now(),
                    true)));

    PlaceDto result = service.getDetails("place-1", null, null, null, true).orElseThrow();

    assertEquals("https://lh3.googleusercontent.com/photo", result.getPrimaryPhoto().url());
    assertEquals(1, result.getPhotoGallery().size());
    verify(provider).getPhotoGallery("provider-1", 3);
    verify(repository).save(entity);
    assertEquals(List.of("https://lh3.googleusercontent.com/photo"), entity.getPhotos());
  }

  @Test
  void usesFreshStoredPhotosWithoutSpendingProviderCredits() {
    Place entity = completeEntity(Instant.now());
    entity.setPhotos(List.of("https://lh3.googleusercontent.com/existing-photo"));
    PlaceDto dto = completeDto();
    dto.setProvider("ziomap");
    dto.setProviderPlaceId("provider-1");
    dto.setPhotos(List.of("https://lh3.googleusercontent.com/existing-photo"));
    PlacePhotoDto freshPhoto =
        new PlacePhotoDto(
            "https://lh3.googleusercontent.com/existing-photo",
            "ziomap",
            List.of(),
            Instant.now(),
            true);
    dto.setPrimaryPhoto(freshPhoto);
    dto.setPhotoGallery(List.of(freshPhoto));
    when(cache.getPlaceDetails("place-1")).thenReturn(Optional.empty());
    when(repository.findById("place-1")).thenReturn(Optional.of(entity));
    when(persistence.toDto(entity)).thenReturn(dto);

    PlaceDto result = service.getDetails("place-1", null, null, null, true).orElseThrow();

    assertEquals(
        "https://lh3.googleusercontent.com/existing-photo", result.getPrimaryPhoto().url());
    assertEquals(1, result.getPhotoGallery().size());
    verify(provider, never()).getPhotoGallery(any(), anyInt());
    verify(repository, never()).save(any());
  }

  @Test
  void refreshesExpiredStoredPhotoUrlsInsteadOfReturningBrokenMedia() {
    Place entity = completeEntity(Instant.now().minus(30, ChronoUnit.DAYS));
    entity.setPhotos(List.of("https://lh3.googleusercontent.com/expired-photo"));
    PlaceDto dto = completeDto();
    dto.setProvider("ziomap");
    dto.setProviderPlaceId("provider-1");
    dto.setPhotos(List.of("https://lh3.googleusercontent.com/expired-photo"));
    PlacePhotoDto expiredPhoto =
        new PlacePhotoDto(
            "https://lh3.googleusercontent.com/expired-photo",
            "ziomap",
            List.of(),
            Instant.now().minus(30, ChronoUnit.DAYS),
            true);
    dto.setPrimaryPhoto(expiredPhoto);
    dto.setPhotoGallery(List.of(expiredPhoto));
    PlacePhotoDto refreshedPhoto =
        new PlacePhotoDto(
            "https://lh3.googleusercontent.com/refreshed-photo",
            "ziomap",
            List.of(),
            Instant.now(),
            true);
    when(cache.getPlaceDetails("place-1")).thenReturn(Optional.empty());
    when(repository.findById("place-1")).thenReturn(Optional.of(entity));
    when(persistence.toDto(entity)).thenReturn(dto);
    when(provider.getProviderName()).thenReturn("ziomap");
    when(provider.getPhotoGallery("provider-1", 3)).thenReturn(List.of(refreshedPhoto));

    PlaceDto result = service.getDetails("place-1", null, null, null, true).orElseThrow();

    assertEquals("https://lh3.googleusercontent.com/refreshed-photo", result.getPrimaryPhoto().url());
    assertEquals(List.of("https://lh3.googleusercontent.com/refreshed-photo"), result.getPhotos());
    verify(provider).getPhotoGallery("provider-1", 3);
  }

  @Test
  void removesExpiredStoredPhotoUrlsWhenProviderCannotRefreshThem() {
    Place entity = completeEntity(Instant.now().minus(30, ChronoUnit.DAYS));
    PlaceDto dto = completeDto();
    dto.setProvider("ziomap");
    dto.setProviderPlaceId("provider-1");
    dto.setPhotos(List.of("https://lh3.googleusercontent.com/expired-photo"));
    PlacePhotoDto expiredPhoto =
        new PlacePhotoDto(
            "https://lh3.googleusercontent.com/expired-photo",
            "ziomap",
            List.of(),
            Instant.now().minus(30, ChronoUnit.DAYS),
            true);
    dto.setPrimaryPhoto(expiredPhoto);
    dto.setPhotoGallery(List.of(expiredPhoto));
    when(cache.getPlaceDetails("place-1")).thenReturn(Optional.empty());
    when(repository.findById("place-1")).thenReturn(Optional.of(entity));
    when(persistence.toDto(entity)).thenReturn(dto);
    when(provider.getProviderName()).thenReturn("ziomap");
    when(provider.getPhotoGallery("provider-1", 3)).thenReturn(List.of());

    PlaceDto result = service.getDetails("place-1", null, null, null, true).orElseThrow();

    assertEquals(List.of(), result.getPhotos());
    assertEquals(null, result.getPrimaryPhoto());
    assertEquals(null, result.getPhotoGallery());
  }

  @Test
  void ordinaryDetailsDoNotSpendPhotoCredits() {
    Place entity = completeEntity(Instant.now());
    PlaceDto dto = completeDto();
    when(cache.getPlaceDetails("place-1")).thenReturn(Optional.empty());
    when(repository.findById("place-1")).thenReturn(Optional.of(entity));
    when(persistence.toDto(entity)).thenReturn(dto);

    service.getDetails("place-1", null, null, null).orElseThrow();

    verify(provider, never()).getPhotoGallery(any(), anyInt());
  }

  @Test
  void refreshesStaleStoredDetailsThroughAbstraction() {
    Place entity = completeEntity(Instant.now().minus(31, ChronoUnit.DAYS));
    PlaceDto current = completeDto();
    PlaceDto enrichment = PlaceDto.builder().name("Updated Cafe").phone("0905").build();
    PlaceDto updated = PlaceDto.builder().id("place-1").name("Updated Cafe").phone("0905").build();
    when(cache.getPlaceDetails("place-1")).thenReturn(Optional.empty());
    when(repository.findById("place-1")).thenReturn(Optional.of(entity));
    when(persistence.toDto(entity)).thenReturn(current);
    when(enrichmentProvider.enrichPlace(eq("Cafe"), any(), any()))
        .thenReturn(Optional.of(enrichment));
    when(persistence.enrichExistingPlace(entity, enrichment)).thenReturn(updated);

    PlaceDto result = service.getDetails("place-1", null, null, null).orElseThrow();

    assertEquals(updated, result);
  }

  @Test
  void servesStoredDetailsWhenEnrichmentProviderFails() {
    Place entity = completeEntity(Instant.now().minus(31, ChronoUnit.DAYS));
    PlaceDto current = completeDto();
    when(cache.getPlaceDetails("place-1")).thenReturn(Optional.empty());
    when(repository.findById("place-1")).thenReturn(Optional.of(entity));
    when(persistence.toDto(entity)).thenReturn(current);
    when(enrichmentProvider.enrichPlace(eq("Cafe"), any(), any()))
        .thenThrow(new PlaceProviderException("down", new RuntimeException()));

    PlaceDto result = service.getDetails("place-1", null, null, null).orElseThrow();

    assertEquals(current, result);
  }

  @Test
  void triggersIndexingOnPlaceDetailsLookup() {
    Place entity = completeEntity(Instant.now());
    PlaceDto dto = completeDto();
    when(cache.getPlaceDetails("place-1")).thenReturn(Optional.empty());
    when(repository.findById("place-1")).thenReturn(Optional.of(entity));
    when(persistence.toDto(entity)).thenReturn(dto);

    service.getDetails("place-1", null, null, null);

    verify(recommendationIndexerClient).triggerIndexingAsync(any());
  }

  @Test
  void getSnapshotsFetchesBatchFromRepositoryWithoutExternalCalls() {
    Place entity1 = completeEntity(Instant.now());
    PlaceDto dto1 = completeDto();
    when(repository.findAllById(List.of("place-1", "place-2"))).thenReturn(List.of(entity1));
    when(repository.findByProviderPlaceIdIn(List.of("place-2"))).thenReturn(List.of());
    when(persistence.toDto(entity1)).thenReturn(dto1);

    List<PlaceDto> snapshots = service.getSnapshots(List.of("place-1", "place-2"));

    assertEquals(1, snapshots.size());
    assertEquals("place-1", snapshots.get(0).getId());
    verify(provider, never()).getPlaceDetails(any());
    verify(enrichmentProvider, never()).enrichPlace(any(), any(), any());
  }

  @Test
  void servesPermanentCloudinaryPhotosWithoutProviderCall() {
    String cdnUrl = "https://res.cloudinary.com/dejiclsce/image/upload/v1/tripsense/places/p1/photo_0.jpg";
    Place entity = completeEntity(Instant.now().minus(30, ChronoUnit.DAYS));
    entity.setPhotos(List.of(cdnUrl));
    PlaceDto dto = completeDto();
    dto.setPhotos(List.of(cdnUrl));

    when(cache.getPlaceDetails("place-1")).thenReturn(Optional.empty());
    when(repository.findById("place-1")).thenReturn(Optional.of(entity));
    when(persistence.toDto(entity)).thenReturn(dto);

    Optional<PlaceDto> result = service.getDetails("place-1", "Cafe", null, null, true);

    assertTrue(result.isPresent());
    assertEquals(1, result.get().getPhotoGallery().size());
    assertEquals(cdnUrl, result.get().getPrimaryPhoto().url());
    verify(provider, never()).getPhotoGallery(any(), anyInt());
  }

  @Test
  void reEnrichesEphemeralPhotosAndUploadsToCloudinary() {
    String googleUrl = "https://lh3.googleusercontent.com/grass-cs/expired=s4800";
    String freshGoogleUrl = "https://lh3.googleusercontent.com/grass-cs/fresh=s4800";
    String cdnUrl = "https://res.cloudinary.com/dejiclsce/image/upload/v1/tripsense/places/provider-1/photo_0.jpg";

    Place entity = completeEntity(Instant.now().minus(30, ChronoUnit.DAYS));
    entity.setPhotos(List.of(googleUrl));
    PlaceDto dto = completeDto();
    dto.setProvider("ziomap");
    dto.setProviderPlaceId("provider-1");
    dto.setPhotos(List.of(googleUrl));
    dto.setFetchedAt(Instant.now().minus(30, ChronoUnit.DAYS));

    PlaceCloudinaryStorageService mockCloudinary = org.mockito.Mockito.mock(PlaceCloudinaryStorageService.class);
    when(mockCloudinary.uploadRemotePhoto(eq(freshGoogleUrl), eq("provider-1"), eq(0)))
        .thenReturn(Optional.of(cdnUrl));

    PlaceDetailsService testService =
        new PlaceDetailsServiceImpl(
            repository,
            provider,
            enrichmentProvider,
            cache,
            persistence,
            recommendationIndexerClient,
            mockCloudinary);

    when(cache.getPlaceDetails("place-1")).thenReturn(Optional.empty());
    when(repository.findById("place-1")).thenReturn(Optional.of(entity));
    when(persistence.toDto(entity)).thenReturn(dto);
    when(provider.getProviderName()).thenReturn("ziomap");
    when(provider.getPhotoGallery("provider-1", 3))
        .thenReturn(List.of(new PlacePhotoDto(freshGoogleUrl, "ziomap", List.of(), Instant.now(), true)));

    Optional<PlaceDto> result = testService.getDetails("place-1", "Cafe", null, null, true);

    assertTrue(result.isPresent());
    assertEquals(1, result.get().getPhotoGallery().size());
    assertEquals(cdnUrl, result.get().getPrimaryPhoto().url());
    assertEquals("cloudinary", result.get().getPrimaryPhoto().source());
  }

  @Test
  void getSnapshotsWithIncludePhotoHydratesMissingPhotosAndSkipsPermanentCloudinaryUrls() {
    String cdnUrl =
        "https://res.cloudinary.com/dejiclsce/image/upload/v1/tripsense/places/p1/photo_0.jpg";
    String freshGoogleUrl = "https://lh3.googleusercontent.com/grass-cs/fresh-p2=s4800";
    String uploadedCdnUrl =
        "https://res.cloudinary.com/dejiclsce/image/upload/v1/tripsense/places/provider-2/photo_0.jpg";

    Place entity1 = completeEntity(Instant.now());
    entity1.setId("place-1");
    entity1.setPhotos(List.of(cdnUrl));
    PlaceDto dto1 = completeDto();
    dto1.setId("place-1");
    dto1.setPhotos(List.of(cdnUrl));

    Place entity2 = completeEntity(Instant.now().minus(1, ChronoUnit.HOURS));
    entity2.setId("place-2");
    entity2.setProviderPlaceId("provider-2");
    entity2.setPhotos(List.of());
    PlaceDto dto2 = completeDto();
    dto2.setId("place-2");
    dto2.setProvider("ziomap");
    dto2.setProviderPlaceId("provider-2");
    dto2.setPhotos(List.of());

    PlaceCloudinaryStorageService mockCloudinary =
        org.mockito.Mockito.mock(PlaceCloudinaryStorageService.class);
    when(mockCloudinary.uploadRemotePhoto(eq(freshGoogleUrl), eq("provider-2"), eq(0)))
        .thenReturn(Optional.of(uploadedCdnUrl));

    PlaceDetailsService testService =
        new PlaceDetailsServiceImpl(
            repository,
            provider,
            enrichmentProvider,
            cache,
            persistence,
            recommendationIndexerClient,
            mockCloudinary);

    when(repository.findAllById(List.of("place-1", "place-2")))
        .thenReturn(List.of(entity1, entity2));
    when(persistence.toDto(entity1)).thenReturn(dto1);
    when(persistence.toDto(entity2)).thenReturn(dto2);

    when(cache.getPlaceDetails("place-2")).thenReturn(Optional.empty());
    when(repository.findById("place-2")).thenReturn(Optional.of(entity2));
    when(provider.getProviderName()).thenReturn("ziomap");
    when(provider.getPhotoGallery("provider-2", 3))
        .thenReturn(
            List.of(new PlacePhotoDto(freshGoogleUrl, "ziomap", List.of(), Instant.now(), true)));

    List<PlaceDto> snapshots = testService.getSnapshots(List.of("place-1", "place-2"), true);

    assertEquals(2, snapshots.size());
    assertEquals(cdnUrl, snapshots.get(0).getPhotos().get(0));
    assertEquals(uploadedCdnUrl, snapshots.get(1).getPrimaryPhoto().url());
    verify(provider, never()).getPhotoGallery(eq("provider-1"), anyInt());
    verify(provider).getPhotoGallery("provider-2", 3);
  }

  @Test
  void neverPersistsEphemeralGoogleUrlsWhenCloudinaryUploadFails() {
    String freshGoogleUrl = "https://lh3.googleusercontent.com/grass-cs/ephemeral=s4800";

    Place entity = completeEntity(Instant.now().minus(1, ChronoUnit.HOURS));
    entity.setId("place-fail");
    entity.setProviderPlaceId("provider-fail");
    entity.setPhotos(List.of());

    PlaceDto dto = completeDto();
    dto.setId("place-fail");
    dto.setProvider("ziomap");
    dto.setProviderPlaceId("provider-fail");
    dto.setPhotos(List.of());

    PlaceCloudinaryStorageService mockCloudinary =
        org.mockito.Mockito.mock(PlaceCloudinaryStorageService.class);
    when(mockCloudinary.uploadRemotePhoto(eq(freshGoogleUrl), eq("provider-fail"), eq(0)))
        .thenReturn(Optional.empty());

    PlaceDetailsService testService =
        new PlaceDetailsServiceImpl(
            repository,
            provider,
            enrichmentProvider,
            cache,
            persistence,
            recommendationIndexerClient,
            mockCloudinary);

    when(cache.getPlaceDetails("place-fail")).thenReturn(Optional.empty());
    when(repository.findById("place-fail")).thenReturn(Optional.of(entity));
    when(persistence.toDto(entity)).thenReturn(dto);
    when(provider.getProviderName()).thenReturn("ziomap");
    when(provider.getPhotoGallery("provider-fail", 3))
        .thenReturn(
            List.of(new PlacePhotoDto(freshGoogleUrl, "ziomap", List.of(), Instant.now(), true)));

    PlaceDto result = testService.getDetails("place-fail", "Cafe", null, null, true).orElseThrow();

    assertEquals(List.of(), result.getPhotos());
    assertEquals(null, result.getPrimaryPhoto());
    verify(repository, never()).save(any());
  }

  @Test
  void lazyHealReusesJustUploadedCloudinaryPhotosFromDbWithoutDuplicateProviderCalls() {
    String cdnUrl =
        "https://res.cloudinary.com/dejiclsce/image/upload/v1/tripsense/places/provider-race/photo_0.jpg";

    Place staleCachedEntity = completeEntity(Instant.now());
    staleCachedEntity.setId("place-race");
    staleCachedEntity.setProviderPlaceId("provider-race");
    staleCachedEntity.setPhotos(List.of());

    Place freshlySavedEntity = completeEntity(Instant.now());
    freshlySavedEntity.setId("place-race");
    freshlySavedEntity.setProviderPlaceId("provider-race");
    freshlySavedEntity.setPhotos(List.of(cdnUrl));

    PlaceDto emptyCachedDto = completeDto();
    emptyCachedDto.setId("place-race");
    emptyCachedDto.setProvider("ziomap");
    emptyCachedDto.setProviderPlaceId("provider-race");
    emptyCachedDto.setPhotos(List.of());

    when(cache.getPlaceDetails("place-race")).thenReturn(Optional.of(emptyCachedDto));
    when(repository.findById("place-race")).thenReturn(Optional.of(freshlySavedEntity));
    when(provider.getProviderName()).thenReturn("ziomap");

    PlaceDetailsService testService =
        new PlaceDetailsServiceImpl(
            repository,
            provider,
            enrichmentProvider,
            cache,
            persistence,
            recommendationIndexerClient,
            org.mockito.Mockito.mock(PlaceCloudinaryStorageService.class),
            3);

    PlaceDto result = testService.getDetails("place-race", "Cafe", null, null, true).orElseThrow();

    assertEquals(List.of(cdnUrl), result.getPhotos());
    assertEquals(cdnUrl, result.getPrimaryPhoto().url());
    assertEquals("cloudinary", result.getPrimaryPhoto().source());
    verify(provider, never()).getPhotoGallery(any(), anyInt());
  }

  private Place completeEntity(Instant fetchedAt) {
    return Place.builder()
        .id("place-1")
        .provider("ziomap")
        .providerPlaceId("provider-1")
        .name("Cafe")
        .phone("0905")
        .openingHours("08:00-22:00")
        .reviews(List.of(PlaceReview.builder().authorName("Guest").build()))
        .lastFetchedAt(fetchedAt)
        .build();
  }

  private PlaceDto completeDto() {
    return PlaceDto.builder()
        .id("place-1")
        .name("Cafe")
        .phone("0905")
        .openingHours("08:00-22:00")
        .fetchedAt(Instant.now())
        .reviews(List.of(PlaceReviewDto.builder().authorName("Guest").build()))
        .build();
  }
}
