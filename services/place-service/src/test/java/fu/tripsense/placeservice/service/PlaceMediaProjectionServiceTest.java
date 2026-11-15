package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceMediaAsset;
import fu.tripsense.placeservice.domain.model.PlaceMediaState;
import fu.tripsense.placeservice.domain.repository.PlaceMediaAssetRepository;
import fu.tripsense.placeservice.dto.PlaceDto;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PlaceMediaProjectionServiceTest {
  @Mock private PlaceMediaAssetRepository assets;
  @Mock private PlaceMediaStorage storage;

  @Test
  void projectsPrimaryFirstAndReplacesTransientProviderUrls() {
    Place place =
        Place.builder()
            .id("place-1")
            .name("Chùa Pháp Lâm")
            .mediaState(PlaceMediaState.READY)
            .primaryMediaAssetId("pm-2")
            .build();
    PlaceMediaAsset first = asset("pm-1", "public-1");
    PlaceMediaAsset primary = asset("pm-2", "public-2");
    when(assets.findByPlaceIdAndModerationStatusAndHealthStatusAndDeletedAtIsNullOrderByCreatedAtAsc(
            "place-1",
            PlaceMediaAsset.ModerationStatus.APPROVED,
            PlaceMediaAsset.HealthStatus.HEALTHY))
        .thenReturn(List.of(first, primary));
    when(storage.deliveryUrl("public-1")).thenReturn("https://res.cloudinary.com/demo/public-1");
    when(storage.deliveryUrl("public-2")).thenReturn("https://res.cloudinary.com/demo/public-2");

    PlaceDto dto =
        PlaceDto.builder()
            .id("place-1")
            .name("Chùa Pháp Lâm")
            .photos(List.of("https://expired-provider/photo"))
            .build();
    new PlaceMediaProjectionService(assets, storage).decorate(dto, place);

    assertThat(dto.getMedia().state()).isEqualTo("READY");
    assertThat(dto.getMedia().primary().assetId()).isEqualTo("pm-2");
    assertThat(dto.getPhotos())
        .containsExactly(
            "https://res.cloudinary.com/demo/public-2",
            "https://res.cloudinary.com/demo/public-1");
    assertThat(dto.getPrimaryPhoto().source()).isEqualTo("cloudinary");
  }

  @Test
  void clearsExpiredLegacyUrlsWhenNoDurableAssetExists() {
    Place place =
        Place.builder().id("place-2").name("No Photo").mediaState(PlaceMediaState.PENDING).build();
    when(assets.findByPlaceIdAndModerationStatusAndHealthStatusAndDeletedAtIsNullOrderByCreatedAtAsc(
            "place-2",
            PlaceMediaAsset.ModerationStatus.APPROVED,
            PlaceMediaAsset.HealthStatus.HEALTHY))
        .thenReturn(List.of());
    PlaceDto dto =
        PlaceDto.builder()
            .id("place-2")
            .photos(List.of("https://expired-provider/photo"))
            .build();

    new PlaceMediaProjectionService(assets, storage).decorate(dto, place);

    assertThat(dto.getMedia().state()).isEqualTo("PENDING");
    assertThat(dto.getMedia().fallbackKind()).isEqualTo("LOCATION");
    assertThat(dto.getPhotos()).isEmpty();
    assertThat(dto.getPrimaryPhoto()).isNull();
  }

  @Test
  void preservesPermanentCloudinaryPhotosFromPlaceAndStripsGoogleUrlsWhenNoAssetRecordsExist() {
    String cdnUrl =
        "https://res.cloudinary.com/dejiclsce/image/upload/v1/tripsense/places/p3/photo_0.jpg";
    Place place =
        Place.builder()
            .id("place-3")
            .name("Cầu Rồng")
            .mediaState(PlaceMediaState.PENDING)
            .photos(List.of(cdnUrl, "https://lh3.googleusercontent.com/expired"))
            .build();
    when(assets.findByPlaceIdAndModerationStatusAndHealthStatusAndDeletedAtIsNullOrderByCreatedAtAsc(
            "place-3",
            PlaceMediaAsset.ModerationStatus.APPROVED,
            PlaceMediaAsset.HealthStatus.HEALTHY))
        .thenReturn(List.of());
    PlaceDto dto = PlaceDto.builder().id("place-3").photos(place.getPhotos()).build();

    new PlaceMediaProjectionService(assets, storage).decorate(dto, place);

    assertThat(dto.getPhotos()).containsExactly(cdnUrl);
    assertThat(dto.getPrimaryPhoto().url()).isEqualTo(cdnUrl);
    assertThat(dto.getPrimaryPhoto().source()).isEqualTo("cloudinary");
    assertThat(dto.getPhotoGallery()).hasSize(1);
  }

  private PlaceMediaAsset asset(String id, String publicId) {
    return PlaceMediaAsset.builder()
        .id(id)
        .placeId("place-1")
        .storagePublicId(publicId)
        .moderationStatus(PlaceMediaAsset.ModerationStatus.APPROVED)
        .healthStatus(PlaceMediaAsset.HealthStatus.HEALTHY)
        .createdAt(Instant.now())
        .build();
  }
}
