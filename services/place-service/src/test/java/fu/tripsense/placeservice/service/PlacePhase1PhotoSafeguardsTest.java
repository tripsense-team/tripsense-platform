package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.providers.ziomap.ZioMapProvider;
import fu.tripsense.placeservice.service.impl.PlacePersistenceServiceImpl;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

class PlacePhase1PhotoSafeguardsTest {

  @Test
  void persistenceNeverWritesGoogleUrlsAndPreservesCloudinaryUrls() {
    PlaceRepository repository = mock(PlaceRepository.class);
    TripSensePlaceProperties props = new TripSensePlaceProperties();
    PlacePersistenceServiceImpl persistence = new PlacePersistenceServiceImpl(repository, props);

    String existingCdn =
        "https://res.cloudinary.com/dejiclsce/image/upload/v1/tripsense/places/ChIJ1/photo_0.jpg";
    Place existing =
        Place.builder()
            .id("p1")
            .provider("ziomap")
            .providerPlaceId("ChIJ1")
            .name("Cầu Rồng")
            .photos(List.of(existingCdn))
            .lastFetchedAt(Instant.now())
            .build();
    when(repository.findByProviderAndProviderPlaceId("ziomap", "ChIJ1"))
        .thenReturn(Optional.of(existing));
    when(repository.save(any(Place.class))).thenAnswer(inv -> inv.getArgument(0));

    PlaceDto incoming =
        PlaceDto.builder()
            .provider("ziomap")
            .providerPlaceId("ChIJ1")
            .name("Cầu Rồng")
            .photos(List.of("https://lh3.googleusercontent.com/ephemeral-url"))
            .build();

    PlaceDto saved = persistence.upsertProviderPlace(incoming, "ziomap");

    assertThat(existing.getPhotos()).containsExactly(existingCdn);
    assertThat(saved.getPhotos()).containsExactly(existingCdn);
  }

  @Test
  void persistenceToDtoStripsLegacyGoogleUrls() {
    PlaceRepository repository = mock(PlaceRepository.class);
    PlacePersistenceServiceImpl persistence =
        new PlacePersistenceServiceImpl(repository, new TripSensePlaceProperties());

    Place legacyPlace =
        Place.builder()
            .id("p2")
            .provider("ziomap")
            .providerPlaceId("ChIJ2")
            .name("Ngũ Hành Sơn")
            .photos(List.of("https://lh3.googleusercontent.com/expired-403"))
            .lastFetchedAt(Instant.now())
            .build();

    PlaceDto dto = persistence.toDto(legacyPlace);

    assertThat(dto.getPhotos()).isEmpty();
    assertThat(dto.getPrimaryPhoto()).isNull();
    assertThat(dto.getPhotoGallery()).isEmpty();
  }

  @Test
  void relinkExistingCloudinaryPhotosRecoversStaleAndEmptyPlaces() {
    PlaceRepository repository = mock(PlaceRepository.class);
    PlaceDetailsService detailsService = mock(PlaceDetailsService.class);
    ZioMapProvider zioMap = mock(ZioMapProvider.class);
    PlaceCloudinaryStorageService cloudinary = mock(PlaceCloudinaryStorageService.class);

    String cdn1 =
        "https://res.cloudinary.com/dejiclsce/image/upload/v1/tripsense/places/ChIJ1/photo_0.jpg";
    String cdn2 =
        "https://res.cloudinary.com/dejiclsce/image/upload/v1/tripsense/places/ChIJ2/photo_0.jpg";

    Place alreadyOk =
        Place.builder().id("1").providerPlaceId("ChIJ1").photos(List.of(cdn1)).build();
    Place staleGoogle =
        Place.builder()
            .id("2")
            .providerPlaceId("ChIJ2")
            .photos(List.of("https://lh3.googleusercontent.com/old"))
            .build();
    Place noCloudMatch =
        Place.builder().id("3").providerPlaceId("ChIJ3").photos(List.of()).build();

    when(cloudinary.isConfigured()).thenReturn(true);
    when(cloudinary.safeIdentifier("ChIJ1")).thenReturn("ChIJ1");
    when(cloudinary.safeIdentifier("ChIJ2")).thenReturn("ChIJ2");
    when(cloudinary.safeIdentifier("ChIJ3")).thenReturn("ChIJ3");
    when(cloudinary.listExistingPlacePhotos())
        .thenReturn(Map.of("ChIJ1", List.of(cdn1), "ChIJ2", List.of(cdn2), "ChIJ_ORPHAN", List.of("https://res.cloudinary.com/dejiclsce/image/upload/v1/tripsense/places/ChIJ_ORPHAN/photo_0.jpg")));
    when(repository.findAll(PageRequest.of(0, 500)))
        .thenReturn(new PageImpl<>(List.of(alreadyOk, staleGoogle, noCloudMatch)));

    PlaceBatchEnrichmentService service =
        new PlaceBatchEnrichmentService(repository, detailsService, zioMap, cloudinary);

    Map<String, Object> drySummary = service.relinkExistingCloudinaryPhotos(true);
    assertThat(drySummary.get("placesRelinked")).isEqualTo(1);
    assertThat(drySummary.get("alreadyLinked")).isEqualTo(1);
    assertThat(drySummary.get("unmatchedCloudinaryFolders")).isEqualTo(1);
    verify(repository, never()).save(any());

    Map<String, Object> liveSummary = service.relinkExistingCloudinaryPhotos(false);
    assertThat(liveSummary.get("placesRelinked")).isEqualTo(1);
    assertThat(staleGoogle.getPhotos()).containsExactly(cdn2);
    verify(repository).save(staleGoogle);
  }
}

